#!/usr/bin/env bash
# Linux build for Bloom Jump.
#
# Steps:
#   1. cargo build the bloom-linux native crate (produces libbloom_linux.a +
#      cmake-built libbloom_jolt.a / libJolt.a under target/release/build/).
#   2. ./bundle-jolt.sh merges the three archives into libbloom_linux_bundled.a
#      because perry only links the single staticlib named in package.json.
#   3. perry compile src/main.ts -o jump links against the bundled archive.
#
# Pass --run to launch the binary after a successful build.
set -euo pipefail

cd "$(dirname "$0")"
ENGINE_LINUX="../engine/native/linux"

echo "[1/3] cargo build bloom-linux"
( cd "$ENGINE_LINUX" && cargo build --release )

echo "[2/3] bundle Jolt static libs into libbloom_linux_bundled.a"
"$ENGINE_LINUX/bundle-jolt.sh"

echo "[3/3] perry compile src/main.ts -o jump"
perry compile src/main.ts -o jump

if [[ "${1-}" == "--run" ]]; then
  exec ./jump
fi
