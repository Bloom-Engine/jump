#!/usr/bin/env python3
"""Capture raw game frames for every language by driving the native game and
grabbing its window with macOS `screencapture`.

Why this and not the engine's bloom_take_screenshot: that readback only fires in
the deferred render path and produces no file on this setup. Capturing the window
externally keeps the game in its normal (direct-2D) render path, which renders
correctly. The capture binary (built by build_capture.sh with CAPTURE_MODE on)
auto-walks title → level select → gameplay → pause on a 3s/screen wall-clock
timer; this driver finds the window via Quartz and screenshots it near the end of
each hold.

  ┌─────────────────────────────────────────────────────────────────────────┐
  │ ONE-TIME PERMISSION: macOS requires Screen Recording permission for the   │
  │ terminal app to capture another window. On the first run you'll get blank │
  │ captures — grant it in System Settings ▸ Privacy & Security ▸ Screen      │
  │ Recording (enable your Terminal / iTerm), fully quit + reopen the         │
  │ terminal, then re-run.                                                    │
  └─────────────────────────────────────────────────────────────────────────┘

Usage:  python3 store/tools/capture_window.py [lang]   # all 13, or one code
Output: store/screenshots/raw/<lang>/{01-title,02-select,03-play,04-pause}.png
"""
import os, subprocess, sys, time

try:
    import Quartz
except ImportError:
    print("error: Quartz not available (pyobjc). Install with: pip3 install pyobjc-framework-Quartz")
    sys.exit(1)

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
os.chdir(ROOT)
# --mobile captures the forced-mobile build (touch controls, landscape phone
# aspect) into raw_mobile/; default captures the desktop build into raw/.
MOBILE = "--mobile" in sys.argv
BIN = "store/tools/capture_bin_mobile" if MOBILE else "store/tools/capture_bin"
RAW = "store/screenshots/raw_mobile" if MOBILE else "store/screenshots/raw"
SCREENS = ["01-title", "02-select", "03-play", "04-pause"]
# Game holds each screen 3.0s (CAP_HOLD in src/main.ts). Grab near the end of
# each hold, anchored to when the window first appears.
SHOT_OFFSETS = [2.0, 5.0, 8.0, 11.0]

LANGS = [
    ("en", "en-US"), ("de", "de-DE"), ("es", "es-ES"), ("fr", "fr-FR"),
    ("it", "it"), ("ja", "ja"), ("ko", "ko"), ("pt", "pt-BR"),
    ("th", "th"), ("tr", "tr"), ("vi", "vi"), ("id", "id"), ("zh", "zh-Hans"),
]


def find_window():
    """Return (windowid, (w,h)) of the game window, or None."""
    opts = (Quartz.kCGWindowListOptionOnScreenOnly |
            Quartz.kCGWindowListExcludeDesktopElements)
    wins = Quartz.CGWindowListCopyWindowInfo(opts, Quartz.kCGNullWindowID)
    best = None
    for w in wins or []:
        name = (w.get("kCGWindowName") or "")
        owner = (w.get("kCGWindowOwnerName") or "")
        if "Bloom Jump" not in name and "capture_bin" not in owner:
            continue
        if int(w.get("kCGWindowLayer", 0)) != 0:
            continue
        b = w.get("kCGWindowBounds", {})
        area = b.get("Width", 0) * b.get("Height", 0)
        if area < 200 * 200:
            continue
        wid = int(w["kCGWindowNumber"])
        if best is None or area > best[2]:
            best = (wid, (int(b["Width"]), int(b["Height"])), area)
    return (best[0], best[1]) if best else None


def grab(wid, dst):
    subprocess.run(["screencapture", "-x", "-o", "-l", str(wid), "-t", "png", dst],
                   check=False)
    return os.path.exists(dst) and os.path.getsize(dst) > 5000


def capture_lang(code, applelang):
    out = os.path.join(RAW, code)
    os.makedirs(out, exist_ok=True)
    print(f"  {code:3s} ({applelang}) ... ", end="", flush=True)
    proc = subprocess.Popen([f"./{BIN}", "-AppleLanguages", f"({applelang})"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Wait for the window to appear.
    t0 = time.time()
    win = None
    while time.time() - t0 < 4.0:
        win = find_window()
        if win:
            break
        time.sleep(0.25)
    if not win:
        proc.terminate()
        print("NO WINDOW (binary didn't open a window)")
        return False
    wid, _ = win
    t_win = time.time()
    ok = 0
    for off, screen in zip(SHOT_OFFSETS, SCREENS):
        target = t_win + off
        delay = target - time.time()
        if delay > 0:
            time.sleep(delay)
        # the window id can change if the surface was recreated; re-resolve once
        cur = find_window()
        if cur:
            wid = cur[0]
        if grab(wid, os.path.join(out, screen + ".png")):
            ok += 1
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
    if ok == len(SCREENS):
        print("ok")
        return True
    print(f"INCOMPLETE ({ok}/{len(SCREENS)} — blank? grant Screen Recording permission)")
    return False


def main():
    if not os.path.exists(BIN):
        print("Building capture binary...")
        cmd = ["store/tools/build_capture.sh"] + (["--mobile"] if MOBILE else [])
        if subprocess.run(cmd).returncode != 0:
            print("build failed"); sys.exit(1)
    # first non-flag arg is an optional single language code
    only = next((a for a in sys.argv[1:] if not a.startswith("-")), None)
    langs = [l for l in LANGS if (only is None or l[0] == only)]
    print(f"Capturing {len(langs)} language(s) -> {RAW}")
    print("(A game window will open per language; leave it frontmost-ish, don't cover it.)")
    results = [capture_lang(c, a) for c, a in langs]
    n = sum(results)
    print(f"Done: {n}/{len(langs)} complete.")
    if n < len(langs):
        print("If captures were blank: System Settings ▸ Privacy & Security ▸ Screen "
              "Recording ▸ enable your terminal, then fully quit + reopen it and re-run.")
    else:
        print("Next: python3 store/tools/frame_screenshots.py && python3 store/tools/build_metadata.py")


if __name__ == "__main__":
    main()
