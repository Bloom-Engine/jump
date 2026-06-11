# Bloom Jump — App Store launch kit

Everything needed to publish the **App Store** and **Google Play** listings in all
**13 supported languages**: localized copy, exact-dimension framed screenshots, and
a fastlane upload pipeline. One source of truth → generated store assets → upload.

```
store/
  metadata/
    source.json        # ← edit me: all listing copy (name/subtitle/keywords/desc/…) × 13 langs
    captions.json      # ← edit me: marketing caption per screenshot × 13 langs
  tools/
    run_capture.sh         # 1. capture raw game frames (native, all 13 langs)
    build_capture.sh       #    (helper) builds the capture binary
    frame_screenshots.py   # 2. frame + caption → exact store dimensions
    build_metadata.py      # 3. explode copy + stage screenshots into fastlane layout
    patch_engine_web.js    #    (helper) local web-build shim, not needed for the store flow
  fastlane/
    Appfile, Fastfile      # 4. upload lanes (deliver = Apple, supply = Google)
    metadata/, screenshots/   # generated; what fastlane uploads
  screenshots/
    raw/<lang>/…           # generated: clean game captures
    out/<store>/<device>/… # generated: final framed store images
```

`source.json`, `captions.json`, the `tools/`, and the fastlane `Appfile`/`Fastfile`
are tracked in git. Everything generated (`raw/`, `out/`, `fastlane/metadata`,
`fastlane/screenshots`, `capture_bin`) is git-ignored and rebuilt on demand.

## Languages

en · de · es · fr · it · ja · ko · pt-BR · th · tr · vi · id · zh-Hans  (13)

## Screenshot dimensions produced

| Store | Device | Pixels | Orientation |
|---|---|---|---|
| Apple | iPhone 6.9″ | 1290 × 2796 | portrait (required) |
| Apple | iPad 13″ | 2048 × 2732 | portrait (required) |
| Apple | Apple TV | 1920 × 1080 | landscape |
| Apple | Mac | 2880 × 1800 | landscape |
| Google | Phone | 1080 × 1920 | portrait |
| Google | 10″ Tablet | 1600 × 2560 | portrait |
| Google | Feature graphic | 1024 × 500 | landscape (required) |

Each device gets 4 captioned screenshots (title / level select / gameplay / pause),
plus a per-language Google feature graphic.

## The pipeline

### 1. Capture raw game frames — `tools/run_capture.sh`

> **Must run in your macOS GUI session** (a logged-in desktop), **not** over SSH /
> headless. It opens the native game per language (auto-walking title → level
> select → gameplay → pause on a 3 s/screen timer) and grabs the window with macOS
> `screencapture`. Language is chosen per run with the `-AppleLanguages` argument.

> **⚠ One-time permission:** macOS requires **Screen Recording** permission for your
> terminal to capture another window. The *first* run produces blank/`INCOMPLETE`
> captures — then grant it in **System Settings ▸ Privacy & Security ▸ Screen
> Recording** (enable Terminal / iTerm), **fully quit and reopen** the terminal, and
> re-run. Validate with one language first:

```bash
store/tools/run_capture.sh en        # one language — confirm it's not blank
store/tools/run_capture.sh           # then all 13 → store/screenshots/raw/<lang>/
```

*Why screencapture and not the engine's screenshot or the web build?* The engine's
`bloom_take_screenshot` only writes from the deferred render path and produced no
file on this Mac, so we grab the window externally and keep the game in its normal
(direct-2D) render path. The Perry **web** target can't be used either — it drops
the game's state-array writes and never navigates past the title. The capture binary
is a throwaway copy of the game with `CAPTURE_MODE` flipped on (navigation only);
the shipping `src/main.ts` keeps `CAPTURE_MODE = false`. Needs `pyobjc`
(`python3 -c "import Quartz"` — preinstalled here).

**Fallback:** the framing step consumes whatever PNGs sit in `raw/<lang>/`, so you
can also drop in manually-taken `01-title.png`, `02-select.png`, `03-play.png`,
`04-pause.png` (any landscape resolution).

### 2. Frame + caption — `tools/frame_screenshots.py`

```bash
python3 store/tools/frame_screenshots.py            # all languages found in raw/
python3 store/tools/frame_screenshots.py --lang de  # one language
```

Composites each raw frame onto a brand gradient with a localized caption (from
`captions.json`), a rounded shadowed game card, and a feature-pill footer — sized
exactly per the table above. Output: `store/screenshots/out/`. Needs Pillow
(`pip3 install Pillow`) and the macOS `Arial Unicode.ttf` system font (full
CJK/Thai/Latin coverage).

### 3. Stage into fastlane — `tools/build_metadata.py`

```bash
python3 store/tools/build_metadata.py               # text + screenshots
python3 store/tools/build_metadata.py --no-screenshots
```

Explodes `source.json` into the layouts `deliver` (Apple) and `supply` (Google)
expect, copies the framed screenshots into place, and warns on any store
character-limit violations (name ≤ 30, subtitle ≤ 30, keywords ≤ 100, promo ≤ 170,
Google short description ≤ 80, description ≤ 4000).

### 4. Upload — fastlane

Requires fastlane (`brew install fastlane` or `gem install fastlane`). Credentials
reuse what's already in this repo: the App Store Connect API key from
`scripts/asc_builds.py` (`~/.perry/AuthKey_MPJ792KV5Z.p8`) and the Google Play
service-account JSON from `perry.toml`.

```bash
cd store
fastlane ios metadata               # push App Store copy + screenshots (no binary)
fastlane ios text                   # copy only, skip screenshots
fastlane android metadata           # push Google Play listing + screenshots (no binary)
fastlane android metadata dry_run:true   # validate against Google Play without committing
```

These lanes manage **only the listing** (text + screenshots). App binaries continue
to ship via `perry publish` / the release workflow. Neither lane submits for review.

## Editing the copy

Edit `metadata/source.json` (listing text) or `metadata/captions.json` (screenshot
captions), then re-run steps 2–3. Brazilian Portuguese (`pt-BR`) and Simplified
Chinese (`zh-Hans`) are used to match the in-game localization.

## One-shot

```bash
store/tools/run_capture.sh \
  && python3 store/tools/frame_screenshots.py \
  && python3 store/tools/build_metadata.py
# then: cd store && fastlane ios metadata && fastlane android metadata
```
