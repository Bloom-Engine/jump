#!/usr/bin/env bash
# Build a throwaway capture binary: a copy of the game with CAPTURE_MODE flipped
# on. The shipping src/main.ts keeps CAPTURE_MODE = false. The generated copy is
# compiled in-place under src/ (so @bloomengine imports resolve) then removed.
#
#   build_capture.sh            -> store/tools/capture_bin         (desktop UI)
#   build_capture.sh --mobile   -> store/tools/capture_bin_mobile  (forced mobile
#                                  UI: touch controls + landscape phone-aspect window)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

MOBILE=0
[ "${1:-}" = "--mobile" ] && MOBILE=1

TMP="src/_capture_main.ts"
trap 'rm -f "$TMP"' EXIT
# Flip CAPTURE_MODE on. Keep direct-2D (the shipping render path) — capture is
# done externally by screencapture (store/tools/capture_window.py), so we don't
# need the engine's deferred-only bloom_take_screenshot readback.
if [ "$MOBILE" = 1 ]; then
  OUT="store/tools/capture_bin_mobile"
  sed -e 's/const CAPTURE_MODE = false;/const CAPTURE_MODE = true;/' \
      -e 's/const CAPTURE_MOBILE = false;/const CAPTURE_MOBILE = true;/' \
      src/main.ts > "$TMP"
else
  OUT="store/tools/capture_bin"
  sed -e 's/const CAPTURE_MODE = false;/const CAPTURE_MODE = true;/' \
      src/main.ts > "$TMP"
fi

mkdir -p store/tools
perry compile "$TMP" -o "$OUT"
echo "Built $OUT"
