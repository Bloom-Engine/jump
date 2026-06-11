#!/usr/bin/env python3
"""Set Privacy Policy URL (app level) and Support URL (version level, all Apple
platforms) for every existing App Store localization, via the ASC API.

These don't come from source.json (they're the same across languages), so they're
set here directly. PATCH-only: leaves name/subtitle/description/etc. untouched, so
it's safe to run alongside asc_push_metadata.py.
"""
import json, os, time, urllib.request, urllib.error, socket
import jwt

socket.setdefaulttimeout(30)
KEY_ID = "MPJ792KV5Z"
ISSUER = "69a6de6f-e591-47e3-e053-5b8c7c11a4d1"
APP_ID = "6761447092"
BASE = "https://api.appstoreconnect.apple.com/v1"

PRIVACY_URL = "https://www.skelpo.com/en/privacy"
SUPPORT_URL = "https://www.skelpo.com/en/privacy"   # user: same as privacy
MARKETING_URL = None                                # user: skip

EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
            "METADATA_REJECTED", "INVALID_BINARY", "WAITING_FOR_REVIEW"}

_key = open(os.path.expanduser("~/.perry/AuthKey_MPJ792KV5Z.p8")).read()
_tok = jwt.encode({"iss": ISSUER, "iat": int(time.time()), "exp": int(time.time()) + 1100,
                   "aud": "appstoreconnect-v1"}, _key, algorithm="ES256",
                  headers={"kid": KEY_ID, "typ": "JWT"})


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Authorization": f"Bearer {_tok}",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r) if r.status != 204 else {}
    except urllib.error.HTTPError as e:
        print(f"  ! {method} {path} -> {e.code}: {e.read().decode()[:200]}")
        return None


def patch(type_, id_, attrs):
    return api("PATCH", f"/{type_}/{id_}", {"data": {"type": type_, "id": id_, "attributes": attrs}})


def main():
    # ---- Privacy Policy URL (app level, all locales) ----
    iid = api("GET", f"/apps/{APP_ID}/appInfos")["data"][0]["id"]
    locs = api("GET", f"/appInfos/{iid}/appInfoLocalizations?limit=50")["data"]
    n = 0
    for l in locs:
        # privacyPolicyUrl -> iOS/macOS; privacyPolicyText -> tvOS (no browser on
        # Apple TV), so set both. Matches the English setup (URL used as the text).
        if patch("appInfoLocalizations", l["id"],
                 {"privacyPolicyUrl": PRIVACY_URL, "privacyPolicyText": PRIVACY_URL}) is not None:
            n += 1
    print(f"Privacy Policy URL + Text set on {n} app-info locales")

    # ---- Support / Marketing URL (version level, each platform) ----
    for plat in ["IOS", "MAC_OS", "TV_OS"]:
        vers = api("GET", f"/apps/{APP_ID}/appStoreVersions?filter[platform]={plat}"
                          f"&limit=10&fields[appStoreVersions]=appStoreState")["data"]
        ver = next((v for v in vers if v["attributes"]["appStoreState"] in EDITABLE), None)
        if not ver:
            print(f"{plat}: no editable version"); continue
        vlocs = api("GET", f"/appStoreVersions/{ver['id']}/appStoreVersionLocalizations?limit=50")["data"]
        attrs = {"supportUrl": SUPPORT_URL}
        if MARKETING_URL:
            attrs["marketingUrl"] = MARKETING_URL
        m = 0
        for l in vlocs:
            if patch("appStoreVersionLocalizations", l["id"], attrs) is not None:
                m += 1
        print(f"{plat}: Support URL set on {m} locales")
    print("Done.")


if __name__ == "__main__":
    main()
