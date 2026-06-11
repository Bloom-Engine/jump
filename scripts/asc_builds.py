#!/usr/bin/env python3
"""Query App Store Connect for recent builds of com.bloom.jump (app 6761447092).

Lists builds across all platforms (IOS / TV_OS / MAC_OS / WATCH_OS) with their
processing state and pre-release version, so we can confirm tvOS/watchOS uploads
landed. Uses the ES256 JWT auth with AuthKey_MPJ792KV5Z.p8.
"""
import time, jwt, json, urllib.request, sys

KEY_ID = "MPJ792KV5Z"
ISSUER = "69a6de6f-e591-47e3-e053-5b8c7c11a4d1"
APP_ID = "6761447092"
KEY_PATH = "/Users/amlug/.perry/AuthKey_MPJ792KV5Z.p8"

with open(KEY_PATH) as f:
    private_key = f.read()

now = int(time.time())
token = jwt.encode(
    {"iss": ISSUER, "iat": now, "exp": now + 1200, "aud": "appstoreconnect-v1"},
    private_key,
    algorithm="ES256",
    headers={"kid": KEY_ID, "typ": "JWT"},
)

url = (
    "https://api.appstoreconnect.apple.com/v1/builds"
    f"?filter[app]={APP_ID}"
    "&limit=30&sort=-uploadedDate"
    "&fields[builds]=version,processingState,uploadedDate,expired,preReleaseVersion"
    "&include=preReleaseVersion"
    "&fields[preReleaseVersions]=version,platform"
)
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req) as r:
        data = json.load(r)
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
    sys.exit(1)

# map preReleaseVersion id -> (platform, version)
prv = {}
for inc in data.get("included", []):
    if inc["type"] == "preReleaseVersions":
        a = inc["attributes"]
        prv[inc["id"]] = (a.get("platform"), a.get("version"))

rows = []
for b in data.get("data", []):
    a = b["attributes"]
    rel = b.get("relationships", {}).get("preReleaseVersion", {}).get("data")
    plat, ver = prv.get(rel["id"], ("?", "?")) if rel else ("?", "?")
    rows.append((a.get("uploadedDate", ""), plat, ver, a.get("version", ""),
                 a.get("processingState", ""), a.get("expired")))

print(f"{'uploaded':25} {'platform':10} {'relVer':8} {'build':6} {'state':12} expired")
for uploaded, plat, ver, build, state, expired in rows:
    print(f"{uploaded:25} {str(plat):10} {str(ver):8} {str(build):6} {str(state):12} {expired}")

# summary by platform
print("\n=== platforms present ===")
print(sorted({plat for _, plat, *_ in rows}))
