#!/usr/bin/env python3
"""Push localized App Store text metadata via the App Store Connect API directly.

We bypass `fastlane deliver` for text because its metadata upload crashes on this
app ("No data" in fetch_app_store_review_detail — the version has no App Review
detail object yet). Screenshots still go through deliver (a separate, working code
path). This sets, for all 13 languages:

  app level   (appInfoLocalizations)          : name, subtitle   (shared across platforms)
  version level (appStoreVersionLocalizations) : description, keywords, promotional text
                                                 — for the editable IOS / MAC_OS / TV_OS versions

"What's New" is intentionally skipped (not applicable to a first 1.0 version).
Idempotent: PATCHes existing locales, POSTs missing ones.

Usage: python3 store/tools/asc_push_metadata.py [--dry-run]
"""
import json, os, sys, time, urllib.request, urllib.error
import jwt

KEY_ID = "MPJ792KV5Z"
ISSUER = "69a6de6f-e591-47e3-e053-5b8c7c11a4d1"
APP_ID = "6761447092"
KEY_PATH = os.path.expanduser("~/.perry/AuthKey_MPJ792KV5Z.p8")
BASE = "https://api.appstoreconnect.apple.com/v1"
DRY = "--dry-run" in sys.argv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LANGS = json.load(open(os.path.join(ROOT, "store", "metadata", "source.json")))["languages"]
PLATFORMS = ["IOS", "MAC_OS", "TV_OS"]
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
            "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_REVIEW"}

_key = open(KEY_PATH).read()
_tok = jwt.encode({"iss": ISSUER, "iat": int(time.time()), "exp": int(time.time()) + 1100,
                   "aud": "appstoreconnect-v1"}, _key, algorithm="ES256",
                  headers={"kid": KEY_ID, "typ": "JWT"})


def api(method, path, body=None):
    url = path if path.startswith("http") else BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Authorization": f"Bearer {_tok}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r) if r.status != 204 else {}
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> HTTP {e.code}: {e.read().decode()[:300]}")
        return None


def upsert(existing_by_locale, locale, type_, attrs, rel_name, rel_id):
    """PATCH if the locale exists, else POST a new localization."""
    if DRY:
        print(f"    [dry] {locale}: {'PATCH' if locale in existing_by_locale else 'POST'} {list(attrs)}")
        return True
    if locale in existing_by_locale:
        body = {"data": {"type": type_, "id": existing_by_locale[locale], "attributes": attrs}}
        ok = api("PATCH", f"/{type_}/{existing_by_locale[locale]}", body)
    else:
        body = {"data": {"type": type_, "attributes": {**attrs, "locale": locale},
                         "relationships": {rel_name: {"data": {"type": rel_id[0], "id": rel_id[1]}}}}}
        ok = api("POST", f"/{type_}", body)
    return ok is not None


def main():
    # ---- App-level name + subtitle (appInfoLocalizations) ----
    infos = api("GET", f"/apps/{APP_ID}/appInfos?include=appInfoLocalizations")
    info = None
    for d in infos["data"]:
        st = d["attributes"].get("appStoreState") or d["attributes"].get("state")
        if st in EDITABLE or info is None:
            info = d
    info_id = info["id"]
    locs = api("GET", f"/appInfos/{info_id}/appInfoLocalizations?limit=50")
    have = {l["attributes"]["locale"]: l["id"] for l in locs["data"]}
    print(f"App info {info_id}: {len(have)} existing localizations")
    for code, d in LANGS.items():
        loc = d["apple_locale"]
        upsert(have, loc, "appInfoLocalizations",
               {"name": d["name"], "subtitle": d["subtitle"]},
               "appInfo", ("appInfos", info_id))
    print(f"  name + subtitle set for {len(LANGS)} locales")

    # ---- Version-level description / keywords / promo, per platform ----
    for plat in PLATFORMS:
        vers = api("GET", f"/apps/{APP_ID}/appStoreVersions?filter[platform]={plat}"
                          f"&limit=10&fields[appStoreVersions]=versionString,appStoreState")
        ver = next((v for v in vers["data"] if v["attributes"]["appStoreState"] in EDITABLE), None)
        if not ver:
            print(f"{plat}: no editable version, skipping"); continue
        vid = ver["id"]
        vlocs = api("GET", f"/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=50")
        vhave = {l["attributes"]["locale"]: l["id"] for l in vlocs["data"]}
        print(f"{plat} v{ver['attributes']['versionString']} ({vid}): {len(vhave)} localizations")
        for code, d in LANGS.items():
            loc = d["apple_locale"]
            upsert(vhave, loc, "appStoreVersionLocalizations",
                   {"description": d["description"], "keywords": d["keywords"],
                    "promotionalText": d["promo"]},
                   "appStoreVersion", ("appStoreVersions", vid))
        print(f"  description + keywords + promo set for {len(LANGS)} locales")

    print("Done." if not DRY else "Dry run complete (no changes made).")


if __name__ == "__main__":
    main()
