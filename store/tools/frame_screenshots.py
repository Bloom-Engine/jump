#!/usr/bin/env python3
"""Frame raw game captures into store-ready, captioned screenshots.

Input:  store/screenshots/raw/<lang>/{01-title,02-select,03-play,04-pause}.png
        store/metadata/captions.json
Output: store/screenshots/out/<store>/<device>/<lang>/NN-<screen>.png  (exact store dims)
        store/screenshots/out/google/feature_graphic/<lang>.png        (1024x500)

Each framed shot = brand gradient background + a localized marketing caption +
the game capture as a rounded, shadowed card. Sizes match Apple App Store and
Google Play requirements exactly. Pure Pillow; no network, no extra fonts beyond
the macOS system Arial Unicode (full CJK/Thai/Latin coverage).

Usage:
  python3 store/tools/frame_screenshots.py [--lang en] [--only-store apple]
"""
import argparse, json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RAW = os.path.join(ROOT, "store", "screenshots", "raw")
OUT = os.path.join(ROOT, "store", "screenshots", "out")
CAPTIONS = os.path.join(ROOT, "store", "metadata", "captions.json")

# One font with full Latin + CJK + Thai + Vietnamese coverage → consistent look
# across all 13 languages. Bold weight is faked with a stroke + drop shadow.
FONT_PATH = "/Library/Fonts/Arial Unicode.ttf"
if not os.path.exists(FONT_PATH):
    FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"

SCREENS = ["01-title", "02-select", "03-play", "04-pause"]

# Brand gradient (top -> bottom), tuned to match Bloom Jump's sky.
GRAD_TOP = (58, 120, 196)
GRAD_BOT = (22, 40, 78)
CAPTION_RGB = (255, 255, 255)
SHADOW_RGB = (8, 16, 34)

# device specs: name -> (W, H, orientation, source). Exact store-accepted sizes.
# source "mobile" -> raw_mobile/ (forced-mobile build: touch controls, landscape);
# source "desktop" -> raw/ (desktop build). Phones/tablets are landscape mobile;
# Mac/TV stay desktop landscape.
DEVICES = {
    "apple": {
        "iphone_6_9": (2796, 1290, "landscape", "mobile"),
        "ipad_13":    (2732, 2048, "landscape", "mobile"),
        "apple_tv":   (1920, 1080, "landscape", "desktop"),
        "mac":        (2880, 1800, "landscape", "desktop"),
    },
    "google": {
        "phone":  (1920, 1080, "landscape", "mobile"),
        "tablet": (2560, 1600, "landscape", "mobile"),
    },
}

# Mobile captures include the macOS window title bar on top; crop to the game's
# content aspect (window was 1392x642) before framing.
MOBILE_ASPECT = 1392.0 / 642.0


def crop_titlebar(img):
    w, h = img.size
    game_h = round(w / MOBILE_ASPECT)
    if h > game_h + 4:
        return img.crop((0, h - game_h, w, h))
    return img


def vgradient(w, h, top, bot):
    base = Image.new("RGB", (w, h), top)
    grad = Image.new("L", (1, h))
    for y in range(h):
        grad.putpixel((0, y), int(255 * y / max(1, h - 1)))
    grad = grad.resize((w, h))
    botimg = Image.new("RGB", (w, h), bot)
    return Image.composite(botimg, base, grad)


def rounded_card(img, radius, border=4, border_rgb=(255, 255, 255)):
    """Return RGBA card: img with rounded corners + thin border."""
    w, h = img.size
    card = img.convert("RGBA")
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    card.putalpha(mask)
    if border > 0:
        ImageDraw.Draw(card).rounded_rectangle(
            [0, 0, w - 1, h - 1], radius=radius, outline=border_rgb + (235,), width=border)
    return card


def paste_card_with_shadow(canvas, card, cx, cy, blur=42, shadow_alpha=150, dy=20):
    """Paste an RGBA card centered at (cx, cy) with a soft drop shadow."""
    w, h = card.size
    pad = blur * 3
    sh = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    a = card.split()[3].point(lambda p: shadow_alpha if p > 8 else 0)
    shadow.putalpha(a)
    blk = Image.new("RGBA", (w, h), SHADOW_RGB + (0,))
    blk.putalpha(a)
    sh.paste(blk, (pad, pad), blk)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.alpha_composite(sh, (cx - w // 2 - pad, cy - h // 2 - pad + dy))
    canvas.alpha_composite(card, (cx - w // 2, cy - h // 2))


def fit(img, box_w, box_h):
    w, h = img.size
    s = min(box_w / w, box_h / h)
    return img.resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)


def wrap_text(draw, text, font, max_w):
    # CJK has no spaces — wrap per character; others wrap per word.
    if " " not in text.strip():
        lines, cur = [], ""
        for ch in text:
            if draw.textlength(cur + ch, font=font) <= max_w:
                cur += ch
            else:
                lines.append(cur); cur = ch
        if cur:
            lines.append(cur)
        return lines
    words, lines, cur = text.split(), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = wd
    if cur:
        lines.append(cur)
    return lines


def draw_caption(canvas, text, top_y, max_w, font_px, center_x):
    draw = ImageDraw.Draw(canvas)
    # Shrink font until the caption fits in <=2 lines within max_w.
    px = font_px
    while px > 24:
        font = ImageFont.truetype(FONT_PATH, px)
        lines = wrap_text(draw, text, font, max_w)
        if len(lines) <= 2:
            break
        px -= 6
    font = ImageFont.truetype(FONT_PATH, px)
    lines = wrap_text(draw, text, font, max_w)
    line_h = int(px * 1.25)
    y = top_y
    stroke = max(2, px // 22)
    for ln in lines:
        tw = draw.textlength(ln, font=font)
        x = center_x - tw / 2
        draw.text((x + 3, y + 4), ln, font=font, fill=SHADOW_RGB + (180,))  # shadow
        draw.text((x, y), ln, font=font, fill=CAPTION_RGB,
                  stroke_width=stroke, stroke_fill=(20, 36, 66))
        y += line_h
    return y


# Short localized nouns for the three feature pills (level count / fps / lang count).
PILL_LEVELS = {"en": "Levels", "de": "Level", "es": "Niveles", "fr": "Niveaux",
               "it": "Livelli", "ja": "ステージ", "ko": "레벨", "pt": "Fases",
               "th": "ด่าน", "tr": "Seviye", "vi": "Màn", "id": "Level", "zh": "关卡"}
PILL_LANGS = {"en": "Languages", "de": "Sprachen", "es": "Idiomas", "fr": "Langues",
              "it": "Lingue", "ja": "言語", "ko": "언어", "pt": "Idiomas",
              "th": "ภาษา", "tr": "Dil", "vi": "Ngôn ngữ", "id": "Bahasa", "zh": "语言"}


def draw_feature_pills(canvas, y, W, font_px, lang="en"):
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype(FONT_PATH, font_px)
    pills = [f"5 {PILL_LEVELS.get(lang, 'Levels')}", "60 FPS",
             f"13 {PILL_LANGS.get(lang, 'Languages')}"]
    pad_x = int(font_px * 0.9)
    gap = int(font_px * 0.7)
    h = int(font_px * 2.0)
    widths = [draw.textlength(p, font=font) + pad_x * 2 for p in pills]
    total = sum(widths) + gap * (len(pills) - 1)
    x = (W - total) / 2
    for p, pw in zip(pills, widths):
        draw.rounded_rectangle([x, y, x + pw, y + h], radius=h // 2,
                               fill=(255, 255, 255, 38), outline=(255, 255, 255, 90), width=2)
        tw = draw.textlength(p, font=font)
        draw.text((x + (pw - tw) / 2, y + (h - font_px) / 2 - font_px * 0.08),
                  p, font=font, fill=(238, 244, 252))
        x += pw + gap


def compose(device_wh, orientation, raw_img, caption, lang="en"):
    W, H, _ = device_wh
    canvas = vgradient(W, H, GRAD_TOP, GRAD_BOT).convert("RGBA")

    if orientation == "portrait":
        cap_top = int(H * 0.05)
        cap_max_w = int(W * 0.86)
        font_px = int(W * 0.075)
        cap_bottom = draw_caption(canvas, caption, cap_top, cap_max_w, font_px, W // 2)
        # Reserve a footer band for the feature pills, then center the card in the
        # space between the caption and the footer so margins stay balanced.
        footer_y = int(H * 0.90)
        region_top = cap_bottom + int(H * 0.02)
        box_w = int(W * 0.94)
        box_h = footer_y - region_top
        radius = max(18, int(W * 0.03))
        card_img = fit(raw_img, box_w, box_h)
        card = rounded_card(card_img, radius)
        cy = (region_top + footer_y) // 2
        paste_card_with_shadow(canvas, card, W // 2, cy)
        draw_feature_pills(canvas, footer_y + int(H * 0.015), W, int(W * 0.030), lang)
        return canvas.convert("RGB")
    else:  # landscape (TV / Mac)
        cap_top = int(H * 0.06)
        cap_max_w = int(W * 0.8)
        font_px = int(H * 0.072)
        cap_bottom = draw_caption(canvas, caption, cap_top, cap_max_w, font_px, W // 2)
        card_area_top = cap_bottom + int(H * 0.03)
        card_area_bot = int(H * 0.93)
        box_w = int(W * 0.74)
        box_h = card_area_bot - card_area_top
        radius = max(16, int(H * 0.03))

    card_img = fit(raw_img, box_w, box_h)
    card = rounded_card(card_img, radius)
    cy = (card_area_top + card_area_bot) // 2
    paste_card_with_shadow(canvas, card, W // 2, cy)
    return canvas.convert("RGB")


def feature_graphic(raw_play, lang, subtitle):
    """Google Play feature graphic: 1024x500 banner."""
    W, H = 1024, 500
    canvas = vgradient(W, H, GRAD_TOP, GRAD_BOT).convert("RGBA")
    # gameplay strip on the right, faded into the gradient
    strip = fit(raw_play, int(W * 0.5), H)
    sc = rounded_card(strip, 24)
    paste_card_with_shadow(canvas, sc, int(W * 0.74), H // 2, blur=30, dy=10)
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(FONT_PATH, 96)
    sub_font = ImageFont.truetype(FONT_PATH, 40)
    draw.text((58, 150), "Bloom Jump", font=title_font, fill=CAPTION_RGB,
              stroke_width=4, stroke_fill=(20, 36, 66))
    # wrap subtitle to the left half
    lines = wrap_text(draw, subtitle, sub_font, int(W * 0.46))
    y = 270
    for ln in lines[:2]:
        draw.text((60, y), ln, font=sub_font, fill=(225, 233, 245))
        y += 50
    return canvas.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", default=None, help="only this language code")
    ap.add_argument("--only-store", default=None, choices=["apple", "google"])
    args = ap.parse_args()

    caps = json.load(open(CAPTIONS))["captions"]
    src = json.load(open(os.path.join(ROOT, "store", "metadata", "source.json")))["languages"]

    # discover languages from either raw source
    found = set()
    for base in (RAW, os.path.join(ROOT, "store", "screenshots", "raw_mobile")):
        if os.path.isdir(base):
            found |= {d for d in os.listdir(base) if os.path.isdir(os.path.join(base, d))}
    langs = [args.lang] if args.lang else sorted(found)
    stores = [args.only_store] if args.only_store else ["apple", "google"]

    total = 0
    RAW_DESKTOP = os.path.join(ROOT, "store", "screenshots", "raw")
    RAW_MOBILE = os.path.join(ROOT, "store", "screenshots", "raw_mobile")
    for lang in langs:
        lcaps = caps.get(lang, caps["en"])
        for store in stores:
            for device, spec in DEVICES[store].items():
                W, H, orient, source = spec
                rawdir = os.path.join(RAW_MOBILE if source == "mobile" else RAW_DESKTOP, lang)
                if not os.path.isdir(rawdir):
                    continue
                ddir = os.path.join(OUT, store, device, lang)
                os.makedirs(ddir, exist_ok=True)
                for screen in SCREENS:
                    rawp = os.path.join(rawdir, screen + ".png")
                    if not os.path.exists(rawp):
                        continue
                    raw = Image.open(rawp).convert("RGB")
                    if source == "mobile":
                        raw = crop_titlebar(raw)
                    cap = lcaps.get(screen, "")
                    out = compose((W, H, orient), orient, raw, cap, lang)
                    outp = os.path.join(ddir, screen + ".png")
                    out.save(outp)
                    total += 1
        # Google feature graphic (per language) — use the mobile gameplay frame.
        if "google" in stores:
            playp = os.path.join(RAW_MOBILE, lang, "03-play.png")
            if not os.path.exists(playp):
                playp = os.path.join(RAW_DESKTOP, lang, "03-play.png")
            if os.path.exists(playp):
                fgdir = os.path.join(OUT, "google", "feature_graphic")
                os.makedirs(fgdir, exist_ok=True)
                sub = src.get(lang, src["en"]).get("subtitle", "")
                praw = Image.open(playp).convert("RGB")
                if "raw_mobile" in playp:
                    praw = crop_titlebar(praw)
                fg = feature_graphic(praw, lang, sub)
                fg.save(os.path.join(fgdir, lang + ".png"))
                total += 1
        print(f"  ✓ {lang}")
    print(f"Done: {total} images -> {OUT}")


if __name__ == "__main__":
    main()
