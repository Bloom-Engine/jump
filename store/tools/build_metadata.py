#!/usr/bin/env python3
"""Explode store/metadata/source.json into fastlane deliver (Apple App Store) and
supply (Google Play) directory layouts, and stage the framed screenshots into the
exact folders each tool expects. Also validates store character limits.

Outputs under store/fastlane/:
  metadata/<apple_locale>/{name,subtitle,promotional_text,description,keywords,release_notes}.txt
  screenshots/<apple_locale>/<device>_<NN>.png            # deliver infers device by size
  metadata/android/<google_locale>/{title,short_description,full_description}.txt
  metadata/android/<google_locale>/changelogs/default.txt
  metadata/android/<google_locale>/images/{phoneScreenshots,tenInchScreenshots}/*.png
  metadata/android/<google_locale>/images/featureGraphic.png

Usage: python3 store/tools/build_metadata.py [--no-screenshots]
"""
import argparse, json, os, shutil

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = json.load(open(os.path.join(ROOT, "store", "metadata", "source.json")))
LANGS = SRC["languages"]
FL = os.path.join(ROOT, "store", "fastlane")
OUT = os.path.join(ROOT, "store", "screenshots", "out")

LIMITS = {"name": 30, "subtitle": 30, "keywords": 100, "promo": 170,
          "short_description": 80, "description": 4000}

# Apple deliver uploads one platform at a time and detects the device by image
# size, so screenshots are split per platform (iPhone+iPad → ios, Mac → osx,
# Apple TV → tvos). Within a folder, the filename prefix keeps order stable.
APPLE_PLATFORM_DEVICES = {
    "ios":  ["iphone_6_9", "ipad_13"],
    "osx":  ["mac"],
    "tvos": ["apple_tv"],
}
# Google supply image subfolders by device.
GOOGLE_IMG_DIR = {"phone": "phoneScreenshots", "tablet": "tenInchScreenshots"}
SCREENS = ["01-title", "02-select", "03-play", "04-pause"]


def w(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def check(lang, field, text):
    lim = LIMITS.get(field)
    if lim and len(text) > lim:
        print(f"  ⚠ {lang}/{field}: {len(text)} > {lim} chars")


def reset_dir(p):
    if os.path.isdir(p):
        shutil.rmtree(p)
    os.makedirs(p, exist_ok=True)


def build_apple(stage_shots):
    meta = os.path.join(FL, "metadata")
    shots = os.path.join(FL, "screenshots")
    for code, d in LANGS.items():
        loc = d["apple_locale"]
        mdir = os.path.join(meta, loc)
        check(code, "name", d["name"]); check(code, "subtitle", d["subtitle"])
        check(code, "keywords", d["keywords"]); check(code, "promo", d["promo"])
        check(code, "description", d["description"])
        w(os.path.join(mdir, "name.txt"), d["name"])
        w(os.path.join(mdir, "subtitle.txt"), d["subtitle"])
        w(os.path.join(mdir, "keywords.txt"), d["keywords"])
        w(os.path.join(mdir, "promotional_text.txt"), d["promo"])
        w(os.path.join(mdir, "description.txt"), d["description"])
        w(os.path.join(mdir, "release_notes.txt"), d["release_notes"])
        if stage_shots:
            # deliver uploads ONE Apple platform per run and rejects screenshot
            # sizes that don't belong to it, so split by platform.
            for platform, devices in APPLE_PLATFORM_DEVICES.items():
                sdir = os.path.join(shots, platform, loc)
                reset_dir(sdir)
                for dev in devices:
                    for i, screen in enumerate(SCREENS, 1):
                        sp = os.path.join(OUT, "apple", dev, code, screen + ".png")
                        if os.path.exists(sp):
                            shutil.copy(sp, os.path.join(sdir, f"{dev}_{i:02d}_{screen[3:]}.png"))


def build_google(stage_shots):
    base = os.path.join(FL, "metadata", "android")
    for code, d in LANGS.items():
        loc = d["google_locale"]
        mdir = os.path.join(base, loc)
        check(code, "name", d["name"]); check(code, "short_description", d["short_description"])
        check(code, "description", d["description"])
        w(os.path.join(mdir, "title.txt"), d["name"])
        w(os.path.join(mdir, "short_description.txt"), d["short_description"])
        w(os.path.join(mdir, "full_description.txt"), d["description"])
        w(os.path.join(mdir, "changelogs", "default.txt"), d["release_notes"])
        if stage_shots:
            for dev, subdir in GOOGLE_IMG_DIR.items():
                idir = os.path.join(mdir, "images", subdir)
                reset_dir(idir)
                for i, screen in enumerate(SCREENS, 1):
                    sp = os.path.join(OUT, "google", dev, code, screen + ".png")
                    if os.path.exists(sp):
                        shutil.copy(sp, os.path.join(idir, f"{i:02d}_{screen[3:]}.png"))
            fg = os.path.join(OUT, "google", "feature_graphic", code + ".png")
            if os.path.exists(fg):
                w_fg = os.path.join(mdir, "images", "featureGraphic.png")
                os.makedirs(os.path.dirname(w_fg), exist_ok=True)
                shutil.copy(fg, w_fg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-screenshots", action="store_true",
                    help="write only metadata text, skip staging screenshots")
    args = ap.parse_args()
    stage = not args.no_screenshots
    print("Apple (deliver):")
    build_apple(stage)
    print("Google Play (supply):")
    build_google(stage)
    print(f"Done -> {FL}")
    if stage and not os.path.isdir(os.path.join(OUT, "apple")):
        print("  note: no framed screenshots found yet — run frame_screenshots.py first.")


if __name__ == "__main__":
    main()
