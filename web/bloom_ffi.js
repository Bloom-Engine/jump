// Bloom web FFI bridge: boots bloom_web.wasm, wires all bloom_* functions into
// the Perry runtime's __ffiImports, then hands control to Perry via bootPerryWasm.
//
// Architecture:
//   1. bloom_web.wasm (Rust + wgpu → WebGPU/WebGL on <canvas>) loads first.
//   2. We populate __ffiImports with plain JS functions. Perry 0.5.158+ wraps
//      the ffi namespace with wrapFfiForI64, which decodes NaN-boxed BigInt
//      args to real JS values (strings, numbers) before calling us and
//      re-encodes JS returns back to WASM bits. We can ignore NaN-boxing.
//   3. bootPerryWasm instantiates the Perry game WASM against __ffiImports.
//   4. After Perry boot, we drive the rAF loop invoking `runGame`'s closure.

import init, * as bloom from "./pkg/bloom_web.js";

// ----- Synchronous asset fetch (matches native's blocking loadTexture etc.) -----
// Browsers forbid `responseType = "arraybuffer"` on synchronous XHR from a document,
// so we force the response into a binary-safe string via overrideMimeType and
// decode byte-by-byte. Ugly but the only way to stay sync from WASM.
function syncFetchBytes(url) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", url, /*async*/ false);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.send();
  if (xhr.status < 200 || xhr.status >= 300) return null;
  const s = xhr.responseText;
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// Quiet variant — used by bloom_read_file where the path is often an existence probe
// (e.g. level1..level30 — most 404). No warning on misses.
const assetTextCache = new Map();
function readAssetText(path) {
  if (assetTextCache.has(path)) return assetTextCache.get(path);
  let text = "";
  try {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", path, false);
    xhr.overrideMimeType("text/plain; charset=utf-8");
    xhr.send();
    if (xhr.status >= 200 && xhr.status < 300) text = xhr.responseText;
  } catch { /* missing file is expected */ }
  assetTextCache.set(path, text);
  return text;
}

// ----- Input: browser events → bloom's inject_* FFI -----
// Values must match bloom/core's Key enum (engine/src/core/keys.ts), which is
// NOT GLFW-compatible — e.g. ENTER=265, ESCAPE=27, UP=256 (not 265), etc.
const keyMap = {
  KeyA: 65, KeyB: 66, KeyC: 67, KeyD: 68, KeyE: 69, KeyF: 70, KeyG: 71,
  KeyH: 72, KeyI: 73, KeyJ: 74, KeyK: 75, KeyL: 76, KeyM: 77, KeyN: 78,
  KeyO: 79, KeyP: 80, KeyQ: 81, KeyR: 82, KeyS: 83, KeyT: 84, KeyU: 85,
  KeyV: 86, KeyW: 87, KeyX: 88, KeyY: 89, KeyZ: 90,
  Digit0: 48, Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52,
  Digit5: 53, Digit6: 54, Digit7: 55, Digit8: 56, Digit9: 57,
  Space: 32, Enter: 265, Escape: 27, Backspace: 8, Tab: 9, Delete: 127,
  ArrowUp: 256, ArrowDown: 257, ArrowLeft: 258, ArrowRight: 259,
  Insert: 260, Home: 261, End: 262, PageUp: 263, PageDown: 264,
  ShiftLeft: 280, ShiftRight: 281, ControlLeft: 282, ControlRight: 283,
  AltLeft: 284, AltRight: 285, MetaLeft: 286, MetaRight: 287,
  F1: 112, F2: 113, F3: 114, F4: 115, F5: 116, F6: 117,
  F7: 118, F8: 119, F9: 120, F10: 121, F11: 122, F12: 123,
  Quote: 39, Comma: 44, Minus: 45, Period: 46, Slash: 47,
  Semicolon: 59, Equal: 61, BracketLeft: 91, Backslash: 92,
  BracketRight: 93, Backquote: 96,
};

// Only keyboard + gamepad are wired today — bloom_web has no mouse/touch inject FFI yet.
// The jump game works with keyboard alone on desktop.
//
// Key events are QUEUED, not injected immediately, then drained once per frame in
// `flushInput()` right before `bloom_begin_drawing()`. Browser key events fire
// asynchronously, at any point in the frame; the engine computes the pressed edge
// (`is_key_pressed` = down && !prev) in begin_frame and snapshots `prev = down` in
// end_frame. If a keydown lands mid-frame (after begin_frame, before end_frame),
// end_frame folds it into `prev` before any begin_frame sees the transition, so the
// edge is lost and `isKeyPressed` never fires — every menu/level-select that polls
// `isKeyPressed` goes dead while held-state (`isKeyDown`) still works. Draining at a
// fixed point each frame makes the transition observable exactly once.
const inputQueue = [];   // {down:bool, k:int} in arrival order
const deferredUps = [];  // keyups held one frame so a same-frame tap stays down ≥1 frame
function installInputListeners() {
  addEventListener("keydown", (e) => {
    const k = keyMap[e.code];
    if (k !== undefined) { inputQueue.push({ down: true, k }); e.preventDefault(); }
  });
  addEventListener("keyup", (e) => {
    const k = keyMap[e.code];
    if (k !== undefined) { inputQueue.push({ down: false, k }); e.preventDefault(); }
  });
}

// Apply one frame's worth of queued key transitions to the engine, in order.
// A keyup whose keydown arrived in the SAME batch is deferred to next frame so the
// key is "down" for at least one full frame — otherwise a sub-frame tap (down+up
// before a single begin_frame) would cancel out and never register as pressed.
function flushInput() {
  for (let i = 0; i < deferredUps.length; i = i + 1) bloom.bloom_inject_key_up(deferredUps[i]);
  deferredUps.length = 0;
  const downThisFrame = new Set();
  for (let i = 0; i < inputQueue.length; i = i + 1) {
    const ev = inputQueue[i];
    if (ev.down) { bloom.bloom_inject_key_down(ev.k); downThisFrame.add(ev.k); }
    else if (downThisFrame.has(ev.k)) { deferredUps.push(ev.k); }
    else { bloom.bloom_inject_key_up(ev.k); }
  }
  inputQueue.length = 0;
}

// ----- Audio bridge: pull samples from the Rust mixer into a Web Audio sink -----
// `bloom_audio_mix(&mut [f32])` fills a stereo-interleaved buffer (LRLRLR…) with
// every currently-playing sound mixed at the source sample rate (44.1 kHz for
// jump's WAVs). bloom_web's `bloom_init_audio` is a no-op on web by design — the
// comment in lib.rs says "Audio initialization is handled by JS glue (Web Audio
// API AudioContext)", which is what we install here.
//
// Browsers block AudioContext until a user gesture, so we lazily create + resume
// on first input event. ScriptProcessorNode is deprecated but ubiquitous and
// simpler than AudioWorklet for a single mix stream.
const AUDIO_FRAMES = 2048; // per onaudioprocess tick, ~46 ms at 44.1 kHz
function installAudioBridge() {
  let ctx = null;
  let node = null;
  let mixBuf = null;

  const start = () => {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      mixBuf = new Float32Array(AUDIO_FRAMES * 2);
      node = ctx.createScriptProcessor(AUDIO_FRAMES, 0, 2);
      node.onaudioprocess = (e) => {
        bloom.bloom_audio_mix(mixBuf);
        const out = e.outputBuffer;
        const left = out.getChannelData(0);
        const right = out.getChannelData(1);
        for (let i = 0; i < AUDIO_FRAMES; i++) {
          left[i] = mixBuf[i * 2];
          right[i] = mixBuf[i * 2 + 1];
        }
      };
      node.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  };

  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    addEventListener(ev, start, { passive: true })
  );
}

// Perry's wrapFfiForI64 has a "small integer" return short-circuit that returns
// the Number unchanged — but WASM i64 imports require BigInt. e.g. bloom_get_platform
// returns 7.0 → WASM throws "Cannot convert 7 to a BigInt". We wrap every ffi entry
// so Number returns are always re-encoded to BigInt f64-bits; BigInt and undefined
// pass through.
const _buf = new ArrayBuffer(8);
const _f64v = new Float64Array(_buf);
const _u64v = new BigUint64Array(_buf);
function wrapReturn(fn) {
  return (...args) => {
    const v = fn(...args);
    if (typeof v === "number") { _f64v[0] = v; return _u64v[0]; }
    return v; // BigInt / undefined / string / etc. — Perry's wrapper handles the rest.
  };
}

// ----- Build __ffiImports: every bloom_* export, plus overrides for string/asset paths -----
function buildFfiImports() {
  const ffi = {};

  // Default: pass every bloom_* export through as-is. Perry's wrapFfiForI64
  // decodes NaN-boxed args to real JS values and encodes returns, so these
  // can be plain wasm-bindgen exports.
  for (const [name, fn] of Object.entries(bloom)) {
    if (typeof fn === "function" && name.startsWith("bloom_")) ffi[name] = fn;
  }

  // String-path overrides — bloom_web has `_str` / `_bytes` variants for anything
  // that takes a filesystem path or a rendered string. We want the decoded JS
  // string (provided for free by wrapFfiForI64), then delegate.
  ffi.bloom_init_window = (w, h, title, fs) => {
    document.title = String(title) || "Bloom";
    bloom.bloom_init_window(w, h, 0, fs);
  };
  ffi.bloom_set_window_title = (title) => { document.title = String(title); };
  ffi.bloom_draw_text = (text, x, y, size, r, g, b, a) =>
    bloom.bloom_draw_text_str(String(text), x, y, size, r, g, b, a);
  ffi.bloom_measure_text = (text, size) =>
    bloom.bloom_measure_text_str(String(text), size);
  ffi.bloom_draw_text_ex = (font, text, x, y, size, spacing, r, g, b, a) =>
    bloom.bloom_draw_text_ex_str(font, String(text), x, y, size, spacing, r, g, b, a);
  ffi.bloom_measure_text_ex = (font, text, size, spacing) =>
    bloom.bloom_measure_text_ex_str(font, String(text), size, spacing);

  // Asset loaders — fetch bytes, delegate to bloom's `*_bytes` variant.
  const makeLoader = (bytesFn) => (path) => {
    const bytes = syncFetchBytes(String(path));
    return bytes ? bytesFn(bytes) : 0;
  };
  ffi.bloom_load_texture = makeLoader(bloom.bloom_load_texture_bytes);
  ffi.bloom_load_image   = makeLoader(bloom.bloom_load_image_bytes);
  ffi.bloom_load_sound   = makeLoader(bloom.bloom_load_sound_bytes);
  ffi.bloom_load_music   = makeLoader(bloom.bloom_load_music_bytes);
  ffi.bloom_load_font = (path, _size) => {
    const bytes = syncFetchBytes(String(path));
    return bytes ? bloom.bloom_load_font_bytes(bytes) : 0;
  };

  // File I/O — writes go to localStorage (persistent saves), reads check
  // localStorage first and fall back to the HTTP asset tree. That lets the
  // game discover level files via `readFile("assets/levels/level1.txt")`
  // the same way as on native.
  const LS = "bloom_fs:";
  ffi.bloom_write_file = (path, data) => {
    try { localStorage.setItem(LS + String(path), String(data)); return 1; }
    catch { return 0; }
  };
  ffi.bloom_file_exists = (path) => {
    const p = String(path);
    if (localStorage.getItem(LS + p) !== null) return 1;
    return readAssetText(p).length > 0 ? 1 : 0;
  };
  ffi.bloom_read_file = (path) => {
    const p = String(path);
    const saved = localStorage.getItem(LS + p);
    return saved !== null ? saved : readAssetText(p);
  };

  // Fullscreen wires through DOM, not bloom.
  ffi.bloom_toggle_fullscreen = () => {
    const c = document.getElementById("bloom-canvas");
    if (!document.fullscreenElement) c.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // Game loop control — bloom_run_game captures the Perry closure, rAF drives it.
  let gameClosure = null;
  let running = false;
  ffi.bloom_run_game = (closure) => {
    gameClosure = closure;
    running = true;
  };
  // While (!windowShouldClose()) must break once runGame has been registered.
  const origShouldClose = ffi.bloom_window_should_close;
  ffi.bloom_window_should_close = () => (running ? 1 : (origShouldClose ? origShouldClose() : 0));

  // Wrap every ffi entry so Number returns get bit-reinterpreted to BigInt.
  for (const k of Object.keys(ffi)) ffi[k] = wrapReturn(ffi[k]);

  // Expose the loop starter — called by the orchestrator after Perry boot completes.
  globalThis.__bloomStartLoop = () => {
    if (!running || gameClosure === null) {
      console.error("runGame was never invoked by Perry — no frame callback registered");
      return;
    }
    const call1 = globalThis.__memDispatch?.closure_call_1;
    if (!call1) { console.error("Perry closure_call_1 unavailable"); return; }
    const frame = () => {
      if (!running) return;
      try {
        flushInput();   // apply queued key transitions before the engine computes the pressed-edge
        bloom.bloom_begin_drawing();
        call1(gameClosure, bloom.bloom_get_delta_time());
        bloom.bloom_end_drawing();
      } catch (e) {
        console.error("Frame error:", e?.message || e, e?.stack);
        running = false;
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };

  return ffi;
}

// ----- GPU backend selection -----
// The engine needs a WebGPU adapter. Two things make its absence far nastier than it
// should be, and this function handles both.
//
// 1. Having the WebGPU *API* is not the same as having an *adapter*. Chrome ships
//    `navigator.gpu` on by default (since 113), but `requestAdapter()` still returns
//    null when graphics acceleration is off, the GPU is blocklisted, or the session is
//    a VM / remote desktop. Left alone, the engine hits that inside wgpu and panics
//    ("No WebGPU/WebGL adapter found"), boot stalls, and the user sees a wall of Rust
//    stack traces and a bogus "init timed out". So probe for a real adapter here and
//    fail with something a human can act on.
//
// 2. wgpu picks its backend once, in `Instance::new`, on a single question: is
//    `navigator.gpu` defined? (wgpu-29 src/api/instance.rs:74). If it is, wgpu commits
//    to WebGPU and never looks at GL again — so the WebGL2 backend we compile in (the
//    `webgl` feature) can never engage on its own. Hiding `navigator.gpu` from the wasm
//    (an own `undefined` property shadows the Navigator.prototype getter; wgpu reads
//    that as absent) is what routes wgpu to wgpu-core → WebGL2.
//
// That WebGL2 route is plumbed and reachable, but it cannot render yet: Bloom's
// Renderer::new eagerly builds 14 compute pipelines, storage buffers and a 64KB joint
// uniform, and WebGL2 (GLES 3.0) has no compute shaders or storage buffers at all — it
// dies during renderer init. Flipping this to true is only meaningful once the engine
// gains a downlevel/2D-only init path. Until then an automatic fallback would trade one
// crash for another, so we send the user a clear message instead. `?renderer=gl` still
// forces the attempt for engine development.
const WEBGL2_FALLBACK_SUPPORTED = false;

async function selectGpuBackend() {
  const forceGl = new URLSearchParams(location.search).get("renderer") === "gl";

  if (!forceGl && navigator.gpu) {
    let adapter = null;
    try {
      adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    } catch (e) {
      console.warn("navigator.gpu.requestAdapter() threw:", e);
    }
    if (adapter) return "webgpu";
  }

  if (!forceGl && !WEBGL2_FALLBACK_SUPPORTED) return "none";

  // Route wgpu away from WebGPU and onto wgpu-core → WebGL2.
  if ("gpu" in navigator) {
    try {
      Object.defineProperty(navigator, "gpu", { value: undefined, configurable: true });
    } catch (e) {
      console.warn("could not hide navigator.gpu; wgpu will stay on WebGPU:", e);
      return "none";
    }
  }
  return document.createElement("canvas").getContext("webgl2") ? "webgl2" : "none";
}

// ----- Boot sequence -----
async function boot() {
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = "Initializing Bloom engine...";

  await init(); // wasm-bindgen init

  const backend = await selectGpuBackend();
  if (backend === "none") {
    throw new Error(
      "This browser can't provide a WebGPU adapter, which Bloom Jump needs to render.\n\n" +
      "WebGPU itself is enabled by default in Chrome 113+ — an adapter usually goes missing " +
      "because graphics acceleration is switched off (chrome://settings/system), the GPU is " +
      "blocklisted, or the browser is running in a VM or remote session. " +
      "Open chrome://gpu and look at the WebGPU row for the specific reason."
    );
  }
  console.log(`[bloom] renderer: ${backend}`);
  if (loading) loading.textContent = `Initializing Bloom engine (${backend})...`;

  installInputListeners();
  installAudioBridge();

  // wgpu surface/device setup is async on the web. Perry's main() is synchronous
  // and calls bloom functions immediately after initWindow — which would panic
  // with "Engine not initialized" if we let Perry run first. So we kick off wgpu
  // init from JS now, wait for bloom_is_initialized → 1, then boot Perry. Perry's
  // eventual initWindow call is a no-op (idempotent on the Rust side).
  const canvas = document.getElementById("bloom-canvas");
  const w = canvas.clientWidth || 800;
  const h = canvas.clientHeight || 600;
  bloom.bloom_init_window(w, h, 0, 0);
  const readyDeadline = Date.now() + 10_000;
  while (bloom.bloom_is_initialized() < 0.5) {
    if (Date.now() > readyDeadline) throw new Error(`bloom engine init timed out (${backend})`);
    await new Promise((r) => setTimeout(r, 16));
  }

  if (loading) loading.textContent = "Loading game...";
  const ffi = buildFfiImports();
  globalThis.__ffiImports = ffi;

  const b64 = globalThis.__perryWasmB64;
  if (!b64) throw new Error("Perry WASM base64 not present on window.__perryWasmB64");

  await globalThis.bootPerryWasm(b64, ffi);

  if (loading) loading.remove();
  globalThis.__bloomStartLoop();
}

boot().catch((err) => {
  console.error("Boot failed:", err, "\nstack:", err?.stack);
  const root = document.getElementById("loading") || document.body;
  root.textContent = err?.message || String(err);
  // The no-GPU message is multi-line prose meant to be read, not a one-line status.
  root.style.whiteSpace = "pre-wrap";
  root.style.maxWidth = "36rem";
  root.style.margin = "2rem auto";
  root.style.lineHeight = "1.5";
  root.style.textAlign = "left";
});
