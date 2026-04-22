#!/usr/bin/env bash
set -e

# ──────────────────────────────────────────────
# Bloom Jump — Android build script
# ──────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── NDK / SDK environment ────────────────────
export ANDROID_HOME=/Users/amlug/Library/Android/sdk
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/30.0.14904198"
NDK_BIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64/bin"

export CC_aarch64_linux_android="$NDK_BIN/aarch64-linux-android24-clang"
export CXX_aarch64_linux_android="$NDK_BIN/aarch64-linux-android24-clang++"
export AR_aarch64_linux_android="$NDK_BIN/llvm-ar"

LLVM_STRIP="$NDK_BIN/llvm-strip"

# ── Parse flags ──────────────────────────────
INSTALL=0
RUN=0
BUILD_TYPE="assembleDebug"
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"

for arg in "$@"; do
    case "$arg" in
        --install)
            INSTALL=1
            ;;
        --run)
            INSTALL=1
            RUN=1
            ;;
        --release)
            BUILD_TYPE="assembleRelease"
            APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
            ;;
    esac
done

# ── Paths ────────────────────────────────────
SO_OUTPUT="bloom_jump"
JNILIBS_DIR="android/app/src/main/jniLibs/arm64-v8a"
ASSETS_SRC="assets"
ASSETS_DST="android/app/src/main/assets/assets"
PACKAGE="com.bloom.jump"
ACTIVITY="com.bloomengine.jump.BloomActivity"

# ── Step 1: Compile with Perry ───────────────
echo "==> Compiling with Perry (target: android)..."
perry compile --target android src/main.ts -o bloom_jump

# ── Step 2: Strip and copy .so ───────────────
echo "==> Stripping .so..."
"$LLVM_STRIP" "$SO_OUTPUT"

echo "==> Copying .so to jniLibs..."
mkdir -p "$JNILIBS_DIR"
cp "$SO_OUTPUT" "$JNILIBS_DIR/libbloom_jump.so"

# ── Step 3: Regenerate assets (perry compile --target android truncates them) ───
echo "==> Regenerating assets..."
node tools/generate-assets.js > /dev/null 2>&1

echo "==> Syncing assets..."
mkdir -p "$ASSETS_DST"
rsync -a --delete --checksum "$ASSETS_SRC/" "$ASSETS_DST/"

# ── Step 4: Build APK ───────────────────────
echo "==> Building APK ($BUILD_TYPE)..."
cd android
./gradlew "$BUILD_TYPE"
cd ..

echo "==> APK: $APK_PATH"

# ── Step 5: Install (optional) ──────────────
if [ "$INSTALL" -eq 1 ]; then
    echo "==> Installing APK on device..."
    adb install -r "$APK_PATH"
fi

# ── Step 6: Launch (optional) ───────────────
if [ "$RUN" -eq 1 ]; then
    echo "==> Launching $PACKAGE..."
    adb shell am start -n "$PACKAGE/$ACTIVITY"
fi

echo "==> Done."
