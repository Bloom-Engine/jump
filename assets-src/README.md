# assets-src — build inputs & originals (not shipped)

Files here are **not** copied into platform bundles. The runtime `assets/`
directory is bundled wholesale into every distro (iOS .app, macOS .app,
Windows zip, APK, web), so anything that isn't loaded by the game at runtime
lives here instead.

## sounds/ — uncompressed music originals

`music_menu.wav` and `music_game.wav` (48 kHz stereo PCM, ~16 MB total) are
the masters for the OGG Vorbis files the game actually ships
(`assets/sounds/*.ogg`, ~1.3 MB total). The engine decodes OGG on every
platform (lewton, content-sniffed — works on web/wasm too, including Safari).

Regenerate the shipped files after editing a master:

```bash
ffmpeg -i assets-src/sounds/music_menu.wav -q:a 4 assets/sounds/music_menu.ogg
ffmpeg -i assets-src/sounds/music_game.wav -q:a 4 assets/sounds/music_game.ogg
```

Short SFX (jump, coin, …) stay as WAV in `assets/sounds/` — they total <100 KB
and WAV decode has zero seek/latency cost.

## icons/ — app icon build inputs

`icon.png` is the master (referenced by `[project.icons]` in perry.toml).
`icon.iconset/`, `icon.icns`, `ios/`, `tvos/` are derived sizes emitted by
`node tools/generate-icon.js` (Android mipmaps go directly to
`android/app/src/main/res/`). None of these are loaded at runtime.
