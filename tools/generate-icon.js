#!/usr/bin/env node
/**
 * generate-icon.js
 *
 * Generates the Bloom Jump app icon at 1024x1024 (pixel art, upscaled)
 * and all platform-specific sizes for macOS, iOS, tvOS, and Android.
 *
 * Uses ONLY built-in Node.js modules: fs, path, zlib.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }

// ── PNG encoder (same as generate-assets.js) ──

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makePNGChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, 'ascii');
  const crcD = Buffer.concat([typeB, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcD), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function createImageBuffer(w, h) {
  return { width: w, height: h, data: Buffer.alloc(w * h * 4, 0) };
}

function setPixel(img, x, y, r, g, b, a) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = r; img.data[i+1] = g; img.data[i+2] = b; img.data[i+3] = a;
}

function fillRect(img, x0, y0, w, h, r, g, b, a) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      setPixel(img, x0 + dx, y0 + dy, r, g, b, a);
}

function drawCircle(img, cx, cy, radius, r, g, b, a) {
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx * dx + dy * dy <= radius * radius)
        setPixel(img, cx + dx, cy + dy, r, g, b, a);
}

function encodePNG(img) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(img.height * (1 + img.width * 4));
  for (let y = 0; y < img.height; y++) {
    raw[y * (1 + img.width * 4)] = 0; // filter: none
    img.data.copy(raw, y * (1 + img.width * 4) + 1, y * img.width * 4, (y + 1) * img.width * 4);
  }
  const comp = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, makePNGChunk('IHDR', ihdr), makePNGChunk('IDAT', comp), makePNGChunk('IEND', Buffer.alloc(0))]);
}

function savePNG(img, relPath) {
  const p = path.join(ROOT, relPath);
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, encodePNG(img));
  console.log(`  ${relPath}  (${img.width}x${img.height})`);
}

// ── Downscale with area averaging (high quality) ──

function downscale(src, dstW, dstH) {
  const dst = createImageBuffer(dstW, dstH);
  const xRatio = src.width / dstW;
  const yRatio = src.height / dstH;
  for (let dy = 0; dy < dstH; dy++) {
    for (let dx = 0; dx < dstW; dx++) {
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0, count = 0;
      const sx0 = Math.floor(dx * xRatio);
      const sy0 = Math.floor(dy * yRatio);
      const sx1 = Math.floor((dx + 1) * xRatio);
      const sy1 = Math.floor((dy + 1) * yRatio);
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * src.width + sx) * 4;
          rSum += src.data[i]; gSum += src.data[i+1]; bSum += src.data[i+2]; aSum += src.data[i+3];
          count++;
        }
      }
      if (count > 0) {
        const di = (dy * dstW + dx) * 4;
        dst.data[di]   = Math.round(rSum / count);
        dst.data[di+1] = Math.round(gSum / count);
        dst.data[di+2] = Math.round(bSum / count);
        dst.data[di+3] = Math.round(aSum / count);
      }
    }
  }
  return dst;
}

// ── Draw the icon at a design resolution, then upscale ──
// Design at 64x64 pixel art, upscale to 1024x1024 (16x)

const DESIGN = 64;
const SCALE = 16; // 64 * 16 = 1024

function generateIcon64() {
  const img = createImageBuffer(DESIGN, DESIGN);

  // Colors from the game
  const OUTLINE = [0x28, 0x32, 0x48, 255];
  const BODY    = [0x50, 0x8C, 0xE6, 255];
  const BELLY   = [0xE6, 0xDC, 0xC8, 255];
  const CAP     = [0xC8, 0x3C, 0x32, 255];
  const CAP_HI  = [0xE0, 0x50, 0x42, 255];
  const SHOE    = [0xC8, 0x3C, 0x32, 255];
  const EYE_W   = [0xFF, 0xFF, 0xFF, 255];
  const PUPIL   = [0x10, 0x10, 0x18, 255];

  const GRASS     = [0x3C, 0xB4, 0x28, 255];
  const GRASS_HI  = [0x50, 0xD0, 0x40, 255];
  const DIRT      = [0x96, 0x64, 0x37, 255];
  const DIRT_DK   = [0x78, 0x50, 0x28, 255];

  const SKY_TOP    = [0x60, 0xB0, 0xFF]; // bright blue
  const SKY_BOT    = [0xA0, 0xD4, 0xFF]; // lighter blue

  // ── Sky gradient ──
  for (let y = 0; y < 48; y++) {
    const t = y / 47;
    const r = Math.round(SKY_TOP[0] + (SKY_BOT[0] - SKY_TOP[0]) * t);
    const g = Math.round(SKY_TOP[1] + (SKY_BOT[1] - SKY_TOP[1]) * t);
    const b = Math.round(SKY_TOP[2] + (SKY_BOT[2] - SKY_TOP[2]) * t);
    fillRect(img, 0, y, 64, 1, r, g, b, 255);
  }

  // ── Small clouds ──
  fillRect(img, 5, 8, 8, 2, 255, 255, 255, 100);
  fillRect(img, 6, 7, 6, 1, 255, 255, 255, 80);
  fillRect(img, 44, 12, 10, 2, 255, 255, 255, 100);
  fillRect(img, 45, 11, 8, 1, 255, 255, 255, 80);
  fillRect(img, 22, 5, 7, 2, 255, 255, 255, 80);
  fillRect(img, 23, 4, 5, 1, 255, 255, 255, 60);

  // ── Distant hills ──
  for (let x = 0; x < 64; x++) {
    const hill = Math.sin(x * 0.12) * 3 + Math.sin(x * 0.05 + 1) * 5;
    const hillTop = Math.round(40 - hill);
    for (let y = hillTop; y < 48; y++) {
      const alpha = y < hillTop + 2 ? 40 : 60;
      setPixel(img, x, y, 0x3C, 0x90, 0x28, alpha);
    }
  }

  // ── Ground: grass top + dirt ──
  fillRect(img, 0, 48, 64, 4, ...GRASS);
  // Grass highlights
  for (let x = 0; x < 64; x += 3) setPixel(img, x, 48, ...GRASS_HI);
  // Grass blades
  for (const bx of [3, 9, 15, 22, 28, 35, 42, 50, 56, 61]) {
    setPixel(img, bx, 47, ...GRASS);
    if (bx % 7 < 3) setPixel(img, bx, 46, ...GRASS_HI);
  }
  // Dirt
  fillRect(img, 0, 52, 64, 12, ...DIRT);
  // Dirt speckles
  for (const [sx, sy] of [[4,53],[12,55],[20,54],[30,56],[40,53],[50,55],[58,54],[8,57],[25,58],[45,57]]) {
    setPixel(img, sx, sy, ...DIRT_DK);
  }

  // ── Player character (large, centered) ──
  // The character is drawn at ~3x the 16x16 original → ~48 pixels tall mapped to ~30px here
  // Position: centered horizontally, standing on ground
  const px = 20; // left edge of character
  const py = 20; // top of cap

  // Cap
  fillRect(img, px + 4, py, 16, 6, ...CAP);
  fillRect(img, px + 6, py + 6, 12, 2, ...CAP);
  // Cap highlight
  fillRect(img, px + 6, py, 4, 2, ...CAP_HI);
  // Brim
  fillRect(img, px + 2, py, 2, 4, ...CAP);
  fillRect(img, px + 20, py, 2, 2, ...CAP);

  // Body
  fillRect(img, px + 4, py + 6, 16, 16, ...BODY);
  fillRect(img, px + 6, py + 22, 12, 2, ...BODY);

  // Belly
  fillRect(img, px + 6, py + 12, 12, 8, ...BELLY);

  // Eyes (looking slightly right, big for icon readability)
  fillRect(img, px + 6, py + 8, 4, 6, ...EYE_W);
  fillRect(img, px + 14, py + 8, 4, 6, ...EYE_W);
  // Pupils
  fillRect(img, px + 8, py + 10, 2, 4, ...PUPIL);
  fillRect(img, px + 16, py + 10, 2, 4, ...PUPIL);

  // Arms (out to sides, dynamic jump pose)
  // Left arm up
  fillRect(img, px + 1, py + 6, 3, 4, ...BODY);
  fillRect(img, px - 1, py + 4, 3, 3, ...BODY);
  // Right arm up
  fillRect(img, px + 20, py + 6, 3, 4, ...BODY);
  fillRect(img, px + 22, py + 4, 3, 3, ...BODY);

  // Legs (tucked, jumping)
  fillRect(img, px + 4, py + 24, 6, 3, ...SHOE);
  fillRect(img, px + 14, py + 24, 6, 3, ...SHOE);

  // Outline (bottom edges for grounding)
  for (let x = px + 3; x <= px + 20; x++) setPixel(img, x, py + 27, ...OUTLINE);
  for (let x = px + 4; x <= px + 20; x++) setPixel(img, x, py - 1, ...OUTLINE);
  // Side outlines
  for (let y = py; y <= py + 26; y++) {
    setPixel(img, px + 3, y, ...OUTLINE);
    setPixel(img, px + 20, y, ...OUTLINE);
  }

  // ── Small coins floating above/around player ──
  const COIN = [0xFF, 0xD7, 0x00, 255];
  const COIN_HI = [0xFF, 0xF0, 0x60, 255];
  // Coin 1 (top right)
  drawCircle(img, 47, 22, 3, ...COIN);
  setPixel(img, 46, 21, ...COIN_HI);
  // Coin 2 (top left)
  drawCircle(img, 10, 28, 3, ...COIN);
  setPixel(img, 9, 27, ...COIN_HI);
  // Coin 3 (above player)
  drawCircle(img, 32, 14, 3, ...COIN);
  setPixel(img, 31, 13, ...COIN_HI);

  // ── Sparkle accents ──
  setPixel(img, 48, 19, 255, 255, 255, 200);
  setPixel(img, 11, 25, 255, 255, 255, 200);
  setPixel(img, 33, 11, 255, 255, 255, 200);

  return img;
}

// ── Nearest-neighbor upscale (preserves pixel art crispness) ──

function upscaleNN(src, factor) {
  const dstW = src.width * factor;
  const dstH = src.height * factor;
  const dst = createImageBuffer(dstW, dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < dstW; x++) {
      const sx = Math.floor(x / factor);
      const si = (sy * src.width + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst.data[di]   = src.data[si];
      dst.data[di+1] = src.data[si+1];
      dst.data[di+2] = src.data[si+2];
      dst.data[di+3] = src.data[si+3];
    }
  }
  return dst;
}

// ── Generate all sizes ──

console.log('Generating Bloom Jump app icon...\n');

const icon64 = generateIcon64();
const icon1024 = upscaleNN(icon64, SCALE);

// Save master icon
savePNG(icon1024, 'assets/icon.png');

// ── Helper: get icon image at any pixel size ──
function iconAtSize(sz) {
  if (sz <= 64) return downscale(icon1024, sz, sz);
  if (sz === 128) return upscaleNN(icon64, 2);
  if (sz === 256) return upscaleNN(icon64, 4);
  if (sz === 512) return upscaleNN(icon64, 8);
  if (sz === 1024) return icon1024;
  return downscale(icon1024, sz, sz);
}

// ── macOS .iconset (for iconutil → .icns) ──
// macOS expects: icon_{N}x{N}.png at NxN and icon_{N}x{N}@2x.png at 2Nx2N
const macPairs = [16, 32, 128, 256, 512]; // each gets 1x and 2x
ensureDir(path.join(ROOT, 'assets/icon.iconset'));
for (const sz of macPairs) {
  savePNG(iconAtSize(sz), `assets/icon.iconset/icon_${sz}x${sz}.png`);
  savePNG(iconAtSize(sz * 2), `assets/icon.iconset/icon_${sz}x${sz}@2x.png`);
}

// ── iOS sizes ──
const iosSizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
for (const sz of iosSizes) {
  savePNG(iconAtSize(sz), `assets/icons/ios/icon_${sz}x${sz}.png`);
}

// ── Android mipmap sizes ──
const androidSizes = [
  ['mdpi', 48],
  ['hdpi', 72],
  ['xhdpi', 96],
  ['xxhdpi', 144],
  ['xxxhdpi', 192],
];
for (const [density, sz] of androidSizes) {
  savePNG(iconAtSize(sz), `android/app/src/main/res/mipmap-${density}/ic_launcher.png`);
}

// ── tvOS sizes ──
const tvosSizes = [400, 800, 1280];
for (const sz of tvosSizes) {
  savePNG(iconAtSize(sz), `assets/icons/tvos/icon_${sz}x${sz}.png`);
}

console.log('\nDone! Generated all icon sizes.');
console.log('\nTo generate macOS .icns file:');
console.log('  iconutil -c icns assets/icon.iconset -o assets/icon.icns');
