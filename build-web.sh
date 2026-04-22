#!/usr/bin/env bash
# Build Bloom Jump for the web.
#
# Output: dist/web/
#   index.html           Perry-generated game HTML, post-processed to boot via bloom_ffi.js
#   bloom_ffi.js         Orchestrator: loads bloom_web, wires __ffiImports, calls bootPerryWasm
#   pkg/                 bloom_web wasm-bindgen output (rebuilt from ../engine/native/web)
#   assets/              game sprites, sounds, levels (copied from ./assets)
#
# Flags:
#   --skip-bloom   Reuse existing ../engine/native/web/pkg/ (skip wasm-pack)
#   --serve        After build, launch `python3 -m http.server 8080` in dist/web

set -euo pipefail

JUMP_DIR="$(cd "$(dirname "$0")" && pwd)"
BLOOM_WEB="$JUMP_DIR/../engine/native/web"
OUT="$JUMP_DIR/dist/web"

skip_bloom=false
serve=false
for arg in "$@"; do
  case "$arg" in
    --skip-bloom) skip_bloom=true ;;
    --serve) serve=true ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

if [ ! -d "$BLOOM_WEB" ]; then
  echo "error: bloom web crate not found at $BLOOM_WEB" >&2
  exit 1
fi

if ! $skip_bloom; then
  echo "[1/4] Building bloom_web.wasm (wasm-pack release)..."
  (cd "$BLOOM_WEB" && wasm-pack build --target web --out-dir pkg --no-typescript --release 2>&1 | tail -3)
else
  echo "[1/4] Skipping bloom_web build (--skip-bloom)"
fi

echo "[2/4] Compiling game WASM (perry --target web)..."
rm -rf "$OUT"
mkdir -p "$OUT"
perry compile --target web "$JUMP_DIR/src/main.ts" -o "$OUT/game" >/dev/null

echo "[3/4] Assembling dist/web..."
cp -R "$BLOOM_WEB/pkg" "$OUT/pkg"
cp -R "$JUMP_DIR/assets" "$OUT/assets"
cp "$JUMP_DIR/web/bloom_ffi.js" "$OUT/bloom_ffi.js"

# Post-process Perry's self-contained HTML:
#   - The file already sets `window.__perryWasmB64 = "..."` as a global.
#   - It then calls `bootPerryWasm("...big base64...").catch(...)` inline.
#   - We neutralize that inline call (defined but not invoked) and insert
#     `<canvas id="bloom-canvas">` plus a `<script type="module" src="./bloom_ffi.js">`
#     so bloom_ffi.js owns the boot sequence.
python3 "$JUMP_DIR/tools/wire-web-html.py" "$OUT/game.html" "$OUT/index.html"
rm "$OUT/game.html"

echo "[4/4] Done."
WASM_KB=$(($(wc -c < "$OUT/pkg/bloom_web_bg.wasm") / 1024))
HTML_KB=$(($(wc -c < "$OUT/index.html") / 1024))
ASSETS_KB=$(du -sk "$OUT/assets" | cut -f1)
echo "  bloom_web.wasm: ${WASM_KB}KB"
echo "  index.html:     ${HTML_KB}KB"
echo "  assets/:        ${ASSETS_KB}KB"
echo ""
echo "Serve:  (cd $OUT && python3 -m http.server 8080)"
echo "Open:   http://localhost:8080"

if $serve; then
  (cd "$OUT" && exec python3 -m http.server 8080)
fi
