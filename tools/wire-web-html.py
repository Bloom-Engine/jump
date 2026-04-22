#!/usr/bin/env python3
"""Wire Perry's self-contained web HTML to boot through bloom_ffi.js.

Perry's `--target web` emits an HTML where the final <script> contains:
    window.__perryWasmB64 = "...base64...";
    bootPerryWasm("...base64...").catch(err => { ... });

We want bloom_ffi.js to own the boot order (load bloom_web first, wire FFI,
then call bootPerryWasm). So we:

1. Insert <canvas id="bloom-canvas"> and a loading <div> inside <body>.
2. Rewrite the `bootPerryWasm(...).catch(...)` call into an assignment so the
   base64 stays on `window.__perryWasmB64` but nothing runs yet.
3. Expose `__memDispatch` on globalThis so bloom_ffi.js can invoke
   `closure_call_1` when driving the rAF game loop.
4. Append <script type="module" src="./bloom_ffi.js"></script> before </body>.
5. Strip Perry's per-frame mem_call debug console.log calls (pure noise for
   game runs).

Earlier versions of this script carried a large pile of runtime patches for
issues in Perry 0.5.146's --target web (missing trig, string methods
unrouted, NaN canonicalization on Firefox, etc.). Those were fixed upstream
in Perry 0.5.158 (commit b6d3cb9, issue #133) and the patches have been
removed. The remaining steps below are intrinsic to plugging a second WASM
module (bloom_web) into Perry's self-contained HTML.
"""
import re
import sys
from pathlib import Path

INPUT, OUTPUT = Path(sys.argv[1]), Path(sys.argv[2])

html = INPUT.read_text(encoding="utf-8")

# --- 1. Canvas + loading indicator --------------------------------------
body_inject = (
    '<canvas id="bloom-canvas" style="display:block;width:100vw;height:100vh;"></canvas>'
    '<div id="loading" style="position:fixed;inset:0;display:flex;align-items:center;'
    'justify-content:center;color:#fff;font:14px monospace;background:#000;">'
    'Loading…</div>'
)
html, n = re.subn(
    r'<div id="perry-root"></div>',
    body_inject + '<div id="perry-root" style="display:none"></div>',
    html,
    count=1,
)
if n != 1:
    sys.exit("error: could not find <div id=\"perry-root\"></div> to inject canvas")

# --- 2. Neutralize Perry's auto-boot ------------------------------------
pattern = re.compile(
    r'bootPerryWasm\("[A-Za-z0-9+/=]+"\)\.catch\([^)]*\{[^}]*\}\);',
    re.DOTALL,
)
html, n = pattern.subn('window.__perryDeferredBoot = true;', html, count=1)
if n != 1:
    sys.exit("error: could not locate bootPerryWasm(...).catch(...) call")

# --- 3. Expose __memDispatch so bloom_ffi.js can invoke Perry closures ---
html, n = re.subn(
    r'const __memDispatch = \{',
    'const __memDispatch = globalThis.__memDispatch = {',
    html,
    count=1,
)
if n != 1:
    sys.exit("error: could not find __memDispatch declaration")

# --- 4. Load bloom_ffi.js as a module before </body> --------------------
html, n = re.subn(
    r'</body>',
    '<script type="module" src="./bloom_ffi.js"></script>\n</body>',
    html,
    count=1,
)
if n != 1:
    sys.exit("error: could not find </body>")

# --- 5. Silence Perry's mem_call debug spam -----------------------------
# Two console.log calls inside the mem_call dispatcher fire on every
# object_new / object_set — dozens per frame. Useful when debugging Perry
# itself; pure noise for game runs.
html, n1 = re.subn(
    r"if \(name\?\.startsWith\('object'\)\) console\.log\(\"mem_call:\".*?\);",
    "/* mem_call debug log stripped */",
    html, count=1,
)
html, n2 = re.subn(
    r"if \(name\?\.startsWith\('object'\)\) console\.log\(\"  result:\".*?\);",
    "/* mem_call result log stripped */",
    html, count=1,
)
if n1 == 0 or n2 == 0:
    print(f"warning: mem_call log stripper matched {n1}+{n2} (expected 1+1)")

OUTPUT.write_text(html, encoding="utf-8")
print(f"wrote {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB)")
