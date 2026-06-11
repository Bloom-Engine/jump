#!/usr/bin/env bash
# Capture raw game frames for all 13 languages, in your macOS GUI session.
#
# Thin wrapper around capture_window.py, which drives the native game and grabs
# its window with macOS `screencapture` (the engine's own bloom_take_screenshot
# doesn't land a file on this setup). See that script's header for the one-time
# Screen Recording permission note.
#
#   store/tools/run_capture.sh          # all 13 languages
#   store/tools/run_capture.sh de       # just one language
#
# Output: store/screenshots/raw/<lang>/{01-title,02-select,03-play,04-pause}.png
# Then:   python3 store/tools/frame_screenshots.py && python3 store/tools/build_metadata.py
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec python3 store/tools/capture_window.py "$@"
