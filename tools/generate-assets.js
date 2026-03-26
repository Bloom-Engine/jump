#!/usr/bin/env node
/**
 * generate-assets.js
 *
 * Generates ALL game assets for "Bloom Jump" – a 2D pixel-art platformer.
 * Uses ONLY built-in Node.js modules: fs, path, zlib.
 *
 * Outputs:
 *   assets/sprites/*.png   – sprite sheets and backgrounds
 *   assets/sounds/*.wav    – sound effects
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');

// ───────────────────────────────────────────────────────
// Utility: ensure directory exists
// ───────────────────────────────────────────────────────
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

// ───────────────────────────────────────────────────────
// CRC-32 (used by PNG)
// ───────────────────────────────────────────────────────
const crcTable = (function () {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ───────────────────────────────────────────────────────
// Minimal PNG encoder (RGBA, 8-bit)
// ───────────────────────────────────────────────────────
function createImageBuffer(w, h) {
  // RGBA buffer, 4 bytes per pixel
  return { width: w, height: h, data: Buffer.alloc(w * h * 4, 0) };
}

function setPixel(img, x, y, r, g, b, a) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  img.data[i] = r;
  img.data[i + 1] = g;
  img.data[i + 2] = b;
  img.data[i + 3] = a;
}

function getPixel(img, x, y) {
  if (x < 0 || x >= img.width || y < 0 || y >= img.height)
    return [0, 0, 0, 0];
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function fillRect(img, x0, y0, w, h, r, g, b, a) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(img, x0 + dx, y0 + dy, r, g, b, a);
    }
  }
}

function drawCircle(img, cx, cy, radius, r, g, b, a, filled) {
  if (filled) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          setPixel(img, cx + dx, cy + dy, r, g, b, a);
        }
      }
    }
  } else {
    // Bresenham
    let x = radius, y = 0, err = 1 - radius;
    while (x >= y) {
      setPixel(img, cx + x, cy + y, r, g, b, a);
      setPixel(img, cx - x, cy + y, r, g, b, a);
      setPixel(img, cx + x, cy - y, r, g, b, a);
      setPixel(img, cx - x, cy - y, r, g, b, a);
      setPixel(img, cx + y, cy + x, r, g, b, a);
      setPixel(img, cx - y, cy + x, r, g, b, a);
      setPixel(img, cx + y, cy - x, r, g, b, a);
      setPixel(img, cx - y, cy - x, r, g, b, a);
      y++;
      if (err < 0) {
        err += 2 * y + 1;
      } else {
        x--;
        err += 2 * (y - x) + 1;
      }
    }
  }
}

function drawEllipse(img, cx, cy, rx, ry, r, g, b, a, filled) {
  if (filled) {
    for (let dy = -ry; dy <= ry; dy++) {
      for (let dx = -rx; dx <= rx; dx++) {
        if (
          (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1
        ) {
          setPixel(img, cx + dx, cy + dy, r, g, b, a);
        }
      }
    }
  }
}

function drawTriangle(img, x0, y0, x1, y1, x2, y2, r, g, b, a) {
  // filled triangle via scanline
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  for (let y = minY; y <= maxY; y++) {
    const xs = [];
    const edges = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ex0, ey0, ex1, ey1] of edges) {
      if ((ey0 <= y && ey1 >= y) || (ey1 <= y && ey0 >= y)) {
        if (ey0 === ey1) {
          xs.push(ex0, ex1);
        } else {
          xs.push(ex0 + ((y - ey0) * (ex1 - ex0)) / (ey1 - ey0));
        }
      }
    }
    if (xs.length >= 2) {
      xs.sort((a2, b2) => a2 - b2);
      for (let x = Math.ceil(xs[0]); x <= Math.floor(xs[xs.length - 1]); x++) {
        setPixel(img, x, y, r, g, b, a);
      }
    }
  }
}

function drawLine(img, x0, y0, x1, y1, r, g, b, a) {
  // Bresenham
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    setPixel(img, x0, y0, r, g, b, a);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// Build raw scanlines with filter byte 0 (None) for each row
function buildRawScanlines(img) {
  const { width, height, data } = img;
  const rowSize = width * 4;
  const raw = Buffer.alloc(height * (1 + rowSize));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + rowSize);
    raw[offset] = 0; // filter: None
    data.copy(raw, offset + 1, y * rowSize, (y + 1) * rowSize);
  }
  return raw;
}

function makePNGChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

function encodePNG(img) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makePNGChunk('IHDR', ihdr);

  // IDAT
  const raw = buildRawScanlines(img);
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makePNGChunk('IDAT', compressed);

  // IEND
  const iendChunk = makePNGChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function savePNG(img, relPath) {
  const fullPath = path.join(ROOT, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, encodePNG(img));
  console.log(`  PNG  ${relPath}  (${img.width}x${img.height})`);
}

// ───────────────────────────────────────────────────────
// Color helpers
// ───────────────────────────────────────────────────────
function hex(str) {
  // "#RRGGBB" or "#RRGGBBAA"
  const v = str.replace('#', '');
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  const a = v.length >= 8 ? parseInt(v.substring(6, 8), 16) : 255;
  return [r, g, b, a];
}

function c(r, g, b, a) {
  return [r, g, b, a === undefined ? 255 : a];
}

// blitTile: draw into img at tile coords (col, row) each 16x16
// callback gets a setter limited to 16x16 space
function drawInTile(img, col, row, callback) {
  const ox = col * 16;
  const oy = row * 16;
  const api = {
    set(x, y, r, g, b, a) {
      setPixel(img, ox + x, oy + y, r, g, b, a === undefined ? 255 : a);
    },
    fill(x, y, w, h, r, g, b, a) {
      fillRect(img, ox + x, oy + y, w, h, r, g, b, a === undefined ? 255 : a);
    },
    circle(cx, cy, radius, r, g, b, a, filled) {
      // offset
      const absX = ox + cx;
      const absY = oy + cy;
      // clip manually
      if (filled) {
        for (let dy2 = -radius; dy2 <= radius; dy2++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy2 * dy2 <= radius * radius) {
              const px = cx + dx, py = cy + dy2;
              if (px >= 0 && px < 16 && py >= 0 && py < 16) {
                setPixel(img, ox + px, oy + py, r, g, b, a === undefined ? 255 : a);
              }
            }
          }
        }
      }
    },
    ellipse(cx, cy, rx, ry, r, g, b, a) {
      for (let dy2 = -ry; dy2 <= ry; dy2++) {
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx) + (dy2 * dy2) / (ry * ry) <= 1) {
            const px = cx + dx, py = cy + dy2;
            if (px >= 0 && px < 16 && py >= 0 && py < 16) {
              setPixel(img, ox + px, oy + py, r, g, b, a === undefined ? 255 : a);
            }
          }
        }
      }
    },
    triangle(x0, y0, x1, y1, x2, y2, r, g, b, a) {
      drawTriangle(img, ox + x0, oy + y0, ox + x1, oy + y1, ox + x2, oy + y2, r, g, b, a === undefined ? 255 : a);
    },
    line(x0, y0, x1, y1, r, g, b, a) {
      drawLine(img, ox + x0, oy + y0, ox + x1, oy + y1, r, g, b, a === undefined ? 255 : a);
    },
  };
  callback(api);
}

// ───────────────────────────────────────────────────────
// WAV encoder (16-bit PCM mono)
// ───────────────────────────────────────────────────────
const SAMPLE_RATE = 22050;

function encodeWAV(samples) {
  // samples is Float64Array in -1..1 range
  const numSamples = samples.length;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes
  const buf = Buffer.alloc(44 + dataSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);        // chunk size
  buf.writeUInt16LE(1, 20);         // PCM format
  buf.writeUInt16LE(1, 22);         // mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);         // block align
  buf.writeUInt16LE(16, 34);        // bits per sample

  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    let v = Math.round(s * 32767);
    buf.writeInt16LE(v, 44 + i * 2);
  }

  return buf;
}

function saveWAV(samples, relPath) {
  const fullPath = path.join(ROOT, relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, encodeWAV(samples));
  const dur = (samples.length / SAMPLE_RATE).toFixed(3);
  console.log(`  WAV  ${relPath}  (${dur}s, ${samples.length} samples)`);
}

// ───────────────────────────────────────────────────────
// Sound synthesis helpers
// ───────────────────────────────────────────────────────
function makeSamples(duration) {
  return new Float64Array(Math.floor(SAMPLE_RATE * duration));
}

function sineWave(t, freq) {
  return Math.sin(2 * Math.PI * freq * t);
}

function squareWave(t, freq) {
  return sineWave(t, freq) >= 0 ? 1 : -1;
}

function noise() {
  return Math.random() * 2 - 1;
}

function envelope(t, attack, decay, sustain, release, totalDur) {
  if (t < attack) return t / attack;
  if (t < attack + decay) return 1 - (1 - sustain) * ((t - attack) / decay);
  if (t < totalDur - release) return sustain;
  return sustain * (1 - (t - (totalDur - release)) / release);
}

function linearInterp(t, duration, startVal, endVal) {
  return startVal + (endVal - startVal) * (t / duration);
}

// ===================================================================
// SPRITE GENERATION
// ===================================================================

// ───────────────────────────────────────────────────────
// 1. TILESET (128x64, 8 cols x 4 rows of 16x16 tiles)
// ───────────────────────────────────────────────────────
function generateTileset() {
  const img = createImageBuffer(128, 64);

  // ── (0,0) grass-top ──
  drawInTile(img, 0, 0, (t) => {
    // dirt base
    t.fill(0, 4, 16, 12, 0x96, 0x64, 0x37);
    // darker dirt speckles
    for (const [sx, sy] of [[2,7],[5,9],[10,6],[13,11],[7,13],[3,14],[11,8]]) {
      t.set(sx, sy, 0x78, 0x50, 0x28);
    }
    // green top strip
    t.fill(0, 4, 16, 4, 0x3C, 0xB4, 0x28);
    // lighter green highlights on top
    for (let x = 0; x < 16; x += 3) {
      t.set(x, 4, 0x50, 0xD0, 0x40);
    }
    // grass blades poking up
    t.set(2, 3, 0x3C, 0xB4, 0x28);
    t.set(2, 2, 0x3C, 0xB4, 0x28);
    t.set(6, 3, 0x50, 0xD0, 0x40);
    t.set(6, 2, 0x50, 0xD0, 0x40);
    t.set(10, 3, 0x3C, 0xB4, 0x28);
    t.set(10, 2, 0x3C, 0xB4, 0x28);
    t.set(10, 1, 0x3C, 0xB4, 0x28);
    t.set(14, 3, 0x50, 0xD0, 0x40);
    t.set(14, 2, 0x50, 0xD0, 0x40);
  });

  // ── (1,0) grass-top-left ──
  drawInTile(img, 1, 0, (t) => {
    t.fill(0, 4, 16, 12, 0x96, 0x64, 0x37);
    for (const [sx, sy] of [[4,8],[8,10],[12,7],[6,13],[14,12]]) {
      t.set(sx, sy, 0x78, 0x50, 0x28);
    }
    t.fill(0, 4, 16, 4, 0x3C, 0xB4, 0x28);
    // left edge curves: green extends down on left
    t.fill(0, 4, 3, 6, 0x3C, 0xB4, 0x28);
    t.fill(0, 8, 2, 3, 0x3C, 0xB4, 0x28);
    t.set(0, 10, 0x3C, 0xB4, 0x28);
    // grass blades
    t.set(1, 3, 0x3C, 0xB4, 0x28);
    t.set(1, 2, 0x50, 0xD0, 0x40);
    t.set(5, 3, 0x3C, 0xB4, 0x28);
    t.set(9, 3, 0x50, 0xD0, 0x40);
    t.set(9, 2, 0x50, 0xD0, 0x40);
    t.set(13, 3, 0x3C, 0xB4, 0x28);
  });

  // ── (2,0) grass-top-right ──
  drawInTile(img, 2, 0, (t) => {
    t.fill(0, 4, 16, 12, 0x96, 0x64, 0x37);
    for (const [sx, sy] of [[3,9],[7,7],[11,11],[5,14],[1,8]]) {
      t.set(sx, sy, 0x78, 0x50, 0x28);
    }
    t.fill(0, 4, 16, 4, 0x3C, 0xB4, 0x28);
    // right edge curves
    t.fill(13, 4, 3, 6, 0x3C, 0xB4, 0x28);
    t.fill(14, 8, 2, 3, 0x3C, 0xB4, 0x28);
    t.set(15, 10, 0x3C, 0xB4, 0x28);
    // grass blades
    t.set(3, 3, 0x3C, 0xB4, 0x28);
    t.set(3, 2, 0x3C, 0xB4, 0x28);
    t.set(7, 3, 0x50, 0xD0, 0x40);
    t.set(11, 3, 0x3C, 0xB4, 0x28);
    t.set(14, 3, 0x50, 0xD0, 0x40);
    t.set(14, 2, 0x50, 0xD0, 0x40);
  });

  // ── (3,0) dirt ──
  drawInTile(img, 3, 0, (t) => {
    t.fill(0, 0, 16, 16, 0x96, 0x64, 0x37);
    // darker speckles
    const speckles = [
      [2,2],[5,1],[9,3],[13,2],[1,6],[6,5],[10,7],[14,6],
      [3,10],[7,9],[11,11],[15,10],[0,13],[4,14],[8,12],[12,15],
    ];
    for (const [sx, sy] of speckles) {
      t.set(sx, sy, 0x78, 0x50, 0x28);
    }
    // a few lighter speckles
    for (const [sx, sy] of [[4,4],[8,8],[12,12],[1,10]]) {
      t.set(sx, sy, 0xA8, 0x78, 0x46);
    }
  });

  // ── (4,0) brick ──
  drawInTile(img, 4, 0, (t) => {
    t.fill(0, 0, 16, 16, 0xB4, 0x50, 0x32);
    // mortar lines horizontal
    t.fill(0, 5, 16, 1, 0xC8, 0xAA, 0x8C);
    t.fill(0, 11, 16, 1, 0xC8, 0xAA, 0x8C);
    // vertical mortar – offset pattern
    t.fill(7, 0, 1, 6, 0xC8, 0xAA, 0x8C);
    t.fill(0, 6, 1, 6, 0xC8, 0xAA, 0x8C);
    t.fill(15, 6, 1, 6, 0xC8, 0xAA, 0x8C);
    t.fill(7, 12, 1, 4, 0xC8, 0xAA, 0x8C);
    // brick highlights
    for (const [sx, sy] of [[2,1],[10,1],[4,7],[12,7],[2,13],[10,13]]) {
      t.set(sx, sy, 0xC8, 0x64, 0x46);
    }
  });

  // ── (5,0) stone ──
  drawInTile(img, 5, 0, (t) => {
    t.fill(0, 0, 16, 16, 0x80, 0x88, 0x90);
    // lighter highlights
    for (const [sx, sy] of [[3,2],[7,4],[12,3],[2,9],[8,11],[14,8],[5,14]]) {
      t.set(sx, sy, 0xA0, 0xA8, 0xB0);
    }
    // dark cracks
    t.line(2, 5, 6, 7, 0x58, 0x60, 0x68);
    t.line(10, 2, 13, 5, 0x58, 0x60, 0x68);
    t.line(9, 10, 14, 13, 0x58, 0x60, 0x68);
    // edge lines top and bottom
    t.fill(0, 0, 16, 1, 0x60, 0x68, 0x70);
    t.fill(0, 15, 16, 1, 0x60, 0x68, 0x70);
  });

  // ── (6,0) spike-up ──
  drawInTile(img, 6, 0, (t) => {
    // 4 triangular spikes pointing up
    const color = [0x50, 0x50, 0x58, 255];
    const highlight = [0x70, 0x70, 0x78, 255];
    for (let i = 0; i < 4; i++) {
      const baseX = i * 4;
      t.triangle(baseX + 2, 4, baseX, 15, baseX + 3, 15, ...color);
      // highlight on left edge
      t.set(baseX + 1, 10, ...highlight);
      t.set(baseX + 2, 7, ...highlight);
    }
  });

  // ── (7,0) spike-down ──
  drawInTile(img, 7, 0, (t) => {
    const color = [0x50, 0x50, 0x58, 255];
    const highlight = [0x70, 0x70, 0x78, 255];
    for (let i = 0; i < 4; i++) {
      const baseX = i * 4;
      t.triangle(baseX + 2, 12, baseX, 1, baseX + 3, 1, ...color);
      t.set(baseX + 1, 6, ...highlight);
      t.set(baseX + 2, 9, ...highlight);
    }
  });

  // ── (0,1) platform ──
  drawInTile(img, 0, 1, (t) => {
    // thin bar 6px tall, centered vertically (y 5..10)
    t.fill(0, 5, 16, 6, 0x8B, 0x69, 0x14);
    // top highlight
    t.fill(0, 5, 16, 1, 0xB0, 0x8A, 0x28);
    // bottom shadow
    t.fill(0, 10, 16, 1, 0x6B, 0x50, 0x0A);
    // highlight dots
    for (let x = 2; x < 16; x += 4) {
      t.set(x, 7, 0xC8, 0xA0, 0x30);
    }
  });

  // ── (1,1) cloud-left ──
  drawInTile(img, 1, 1, (t) => {
    const w = [0xF0, 0xF0, 0xFF, 200];
    t.circle(6, 10, 5, ...w, true);
    t.circle(4, 7, 3, ...w, true);
    // clip right side stays full, left side rounds off
    for (let y = 0; y < 16; y++) {
      t.set(15, y, 0xF0, 0xF0, 0xFF, 200); // fill rightmost column for seamless tiling
    }
  });

  // ── (2,1) cloud-mid ──
  drawInTile(img, 2, 1, (t) => {
    const w = [0xF0, 0xF0, 0xFF, 200];
    t.fill(0, 6, 16, 8, ...w);
    t.circle(4, 5, 4, ...w, true);
    t.circle(12, 4, 4, ...w, true);
    t.circle(8, 6, 5, ...w, true);
  });

  // ── (3,1) cloud-right ──
  drawInTile(img, 3, 1, (t) => {
    const w = [0xF0, 0xF0, 0xFF, 200];
    t.circle(10, 10, 5, ...w, true);
    t.circle(12, 7, 3, ...w, true);
    for (let y = 0; y < 16; y++) {
      t.set(0, y, 0xF0, 0xF0, 0xFF, 200);
    }
  });

  // ── (4,1) bush ──
  drawInTile(img, 4, 1, (t) => {
    // darker green base
    t.circle(8, 11, 6, 0x2D, 0x8E, 0x1E, 255, true);
    t.circle(4, 10, 4, 0x2D, 0x8E, 0x1E, 255, true);
    t.circle(12, 10, 4, 0x2D, 0x8E, 0x1E, 255, true);
    // lighter green highlights
    t.circle(8, 9, 4, 0x3C, 0xB4, 0x28, 255, true);
    t.circle(5, 9, 3, 0x3C, 0xB4, 0x28, 255, true);
    t.circle(11, 9, 3, 0x3C, 0xB4, 0x28, 255, true);
    // bright highlight dots
    t.set(6, 7, 0x50, 0xD0, 0x40);
    t.set(10, 8, 0x50, 0xD0, 0x40);
  });

  // ── (5,1) tree-trunk ──
  drawInTile(img, 5, 1, (t) => {
    t.fill(5, 0, 6, 16, 0x6E, 0x4A, 0x28);
    // bark detail
    t.fill(5, 0, 1, 16, 0x5A, 0x3C, 0x1E);
    t.fill(10, 0, 1, 16, 0x5A, 0x3C, 0x1E);
    // highlight
    t.fill(7, 0, 2, 16, 0x82, 0x5A, 0x32);
    // knot
    t.set(7, 8, 0x5A, 0x3C, 0x1E);
    t.set(8, 8, 0x5A, 0x3C, 0x1E);
    t.set(7, 9, 0x50, 0x32, 0x1A);
  });

  // ── (6,1) tree-top ──
  drawInTile(img, 6, 1, (t) => {
    // large green circle canopy
    t.circle(8, 8, 7, 0x2D, 0x8E, 0x1E, 255, true);
    // lighter inner circle
    t.circle(7, 7, 5, 0x3C, 0xB4, 0x28, 255, true);
    // highlights
    t.circle(6, 5, 2, 0x50, 0xD0, 0x40, 255, true);
    t.set(5, 4, 0x60, 0xE0, 0x50);
  });

  // ── (7,1) flower ──
  drawInTile(img, 7, 1, (t) => {
    // stem
    t.fill(7, 8, 2, 6, 0x3C, 0xB4, 0x28);
    // leaf
    t.set(6, 11, 0x3C, 0xB4, 0x28);
    t.set(5, 10, 0x3C, 0xB4, 0x28);
    t.set(9, 12, 0x3C, 0xB4, 0x28);
    t.set(10, 11, 0x3C, 0xB4, 0x28);
    // petals (red)
    const petals = [[8,4],[6,6],[10,6],[6,4],[10,4]];
    for (const [px, py] of petals) {
      t.circle(px, py, 2, 0xE8, 0x30, 0x30, 255, true);
    }
    // center (yellow)
    t.circle(8, 5, 1, 0xFF, 0xD2, 0x32, 255, true);
    t.set(8, 5, 0xFF, 0xD2, 0x32);
  });

  // ── Row 2: darker brick, cave walls ──

  // (0,2) dark brick
  drawInTile(img, 0, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x7A, 0x38, 0x28);
    t.fill(0, 5, 16, 1, 0x96, 0x78, 0x64);
    t.fill(0, 11, 16, 1, 0x96, 0x78, 0x64);
    t.fill(7, 0, 1, 6, 0x96, 0x78, 0x64);
    t.fill(0, 6, 1, 6, 0x96, 0x78, 0x64);
    t.fill(15, 6, 1, 6, 0x96, 0x78, 0x64);
    t.fill(7, 12, 1, 4, 0x96, 0x78, 0x64);
  });

  // (1,2) cave wall
  drawInTile(img, 1, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x40, 0x40, 0x48);
    for (const [sx, sy] of [[3,3],[7,1],[12,5],[2,9],[8,12],[14,10],[5,15]]) {
      t.set(sx, sy, 0x50, 0x50, 0x58);
    }
    for (const [sx, sy] of [[1,5],[6,8],[11,2],[9,14],[3,12]]) {
      t.set(sx, sy, 0x30, 0x30, 0x38);
    }
  });

  // (2,2) dark stone
  drawInTile(img, 2, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x60, 0x64, 0x6C);
    t.fill(0, 0, 16, 1, 0x48, 0x4C, 0x54);
    t.fill(0, 15, 16, 1, 0x48, 0x4C, 0x54);
    for (const [sx, sy] of [[4,4],[9,8],[13,12],[2,10]]) {
      t.set(sx, sy, 0x78, 0x7C, 0x84);
    }
    t.line(3, 6, 8, 9, 0x40, 0x44, 0x4C);
  });

  // (3,2) mossy stone
  drawInTile(img, 3, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x80, 0x88, 0x90);
    // moss patches
    t.fill(0, 0, 6, 3, 0x3C, 0x6E, 0x28);
    t.fill(10, 0, 6, 2, 0x3C, 0x6E, 0x28);
    t.fill(3, 14, 8, 2, 0x3C, 0x6E, 0x28);
    for (const [sx, sy] of [[2,3],[12,2],[5,13]]) {
      t.set(sx, sy, 0x50, 0x8E, 0x38);
    }
  });

  // (4,2) cracked stone
  drawInTile(img, 4, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x80, 0x88, 0x90);
    t.line(4, 0, 8, 8, 0x50, 0x54, 0x5C);
    t.line(8, 8, 12, 16, 0x50, 0x54, 0x5C);
    t.line(8, 8, 3, 14, 0x50, 0x54, 0x5C);
    t.set(8, 8, 0x40, 0x44, 0x4C);
  });

  // (5,2) ice block
  drawInTile(img, 5, 2, (t) => {
    t.fill(0, 0, 16, 16, 0x96, 0xC8, 0xE6);
    t.fill(0, 0, 16, 1, 0xB4, 0xDC, 0xF0);
    t.fill(0, 1, 1, 15, 0xB4, 0xDC, 0xF0);
    t.fill(0, 15, 16, 1, 0x6E, 0xA0, 0xC8);
    t.fill(15, 0, 1, 16, 0x6E, 0xA0, 0xC8);
    // shine
    t.set(3, 3, 0xFF, 0xFF, 0xFF);
    t.set(4, 3, 0xFF, 0xFF, 0xFF);
    t.set(3, 4, 0xFF, 0xFF, 0xFF);
  });

  // (6,2) lava top
  drawInTile(img, 6, 2, (t) => {
    t.fill(0, 4, 16, 12, 0xC8, 0x32, 0x14);
    // bright top
    t.fill(0, 4, 16, 3, 0xFF, 0x82, 0x14);
    t.fill(0, 4, 16, 1, 0xFF, 0xC8, 0x32);
    // bubbles
    t.set(4, 8, 0xFF, 0x96, 0x28);
    t.set(10, 10, 0xFF, 0x96, 0x28);
    t.set(7, 12, 0xFF, 0x82, 0x14);
  });

  // (7,2) lava body
  drawInTile(img, 7, 2, (t) => {
    t.fill(0, 0, 16, 16, 0xC8, 0x32, 0x14);
    for (const [sx, sy] of [[3,3],[9,6],[5,10],[12,12],[2,14],[14,2]]) {
      t.set(sx, sy, 0xFF, 0x96, 0x28);
    }
    for (const [sx, sy] of [[7,5],[1,9],[11,1],[13,10]]) {
      t.set(sx, sy, 0x96, 0x1E, 0x0A);
    }
  });

  // ── Row 3: more decorative tiles ──

  // (0,3) wooden plank
  drawInTile(img, 0, 3, (t) => {
    t.fill(0, 0, 16, 16, 0x8B, 0x69, 0x14);
    t.fill(0, 0, 16, 1, 0xA0, 0x7C, 0x1E);
    t.fill(0, 15, 16, 1, 0x6B, 0x50, 0x0A);
    // wood grain
    for (let y = 3; y < 15; y += 4) {
      t.fill(0, y, 16, 1, 0x7A, 0x5A, 0x10);
    }
    // nail
    t.set(2, 2, 0x80, 0x80, 0x88);
    t.set(13, 2, 0x80, 0x80, 0x88);
  });

  // (1,3) grass-body (dirt with grass on sides)
  drawInTile(img, 1, 3, (t) => {
    t.fill(0, 0, 16, 16, 0x96, 0x64, 0x37);
    t.fill(0, 0, 2, 16, 0x3C, 0xB4, 0x28);
    t.fill(14, 0, 2, 16, 0x3C, 0xB4, 0x28);
  });

  // (2,3) sand
  drawInTile(img, 2, 3, (t) => {
    t.fill(0, 0, 16, 16, 0xE6, 0xD2, 0x96);
    for (const [sx, sy] of [[3,3],[8,7],[12,4],[5,12],[14,10],[1,9]]) {
      t.set(sx, sy, 0xD2, 0xBE, 0x82);
    }
    for (const [sx, sy] of [[6,2],[10,9],[2,14]]) {
      t.set(sx, sy, 0xF0, 0xE0, 0xAA);
    }
  });

  // (3,3) water top
  drawInTile(img, 3, 3, (t) => {
    t.fill(0, 4, 16, 12, 0x32, 0x78, 0xC8, 180);
    t.fill(0, 4, 16, 2, 0x64, 0xA0, 0xE6, 200);
    t.fill(0, 4, 16, 1, 0x96, 0xC8, 0xFF, 220);
    // wave highlights
    t.set(3, 4, 0xFF, 0xFF, 0xFF, 180);
    t.set(9, 4, 0xFF, 0xFF, 0xFF, 180);
  });

  // (4,3) water body
  drawInTile(img, 4, 3, (t) => {
    t.fill(0, 0, 16, 16, 0x28, 0x64, 0xB4, 180);
    for (const [sx, sy] of [[4,5],[10,10],[2,13],[14,3]]) {
      t.set(sx, sy, 0x46, 0x82, 0xD2, 160);
    }
  });

  // (5,3) checkpoint pole base
  drawInTile(img, 5, 3, (t) => {
    t.fill(7, 0, 2, 16, 0x80, 0x80, 0x88);
    t.fill(6, 14, 4, 2, 0x60, 0x60, 0x68);
    t.set(7, 1, 0xA0, 0xA0, 0xA8);
  });

  // (6,3) ladder
  drawInTile(img, 6, 3, (t) => {
    t.fill(3, 0, 2, 16, 0x8B, 0x69, 0x14);
    t.fill(11, 0, 2, 16, 0x8B, 0x69, 0x14);
    // rungs
    for (let y = 2; y < 16; y += 4) {
      t.fill(3, y, 10, 2, 0xA0, 0x7C, 0x1E);
    }
  });

  // (7,3) sign post
  drawInTile(img, 7, 3, (t) => {
    // post
    t.fill(7, 6, 2, 10, 0x6E, 0x4A, 0x28);
    // sign board
    t.fill(2, 1, 12, 7, 0x8B, 0x69, 0x14);
    t.fill(3, 2, 10, 5, 0xA0, 0x7C, 0x1E);
    // exclamation mark
    t.fill(7, 2, 2, 3, 0x50, 0x32, 0x14);
    t.fill(7, 6, 2, 1, 0x50, 0x32, 0x14);
  });

  savePNG(img, 'assets/sprites/tileset.png');
}

// ───────────────────────────────────────────────────────
// 2. PLAYER SPRITE SHEET (160x16, 10 frames of 16x16)
// ───────────────────────────────────────────────────────
function generatePlayer() {
  const img = createImageBuffer(160, 16);

  const OUTLINE = [0x28, 0x32, 0x48, 255];
  const BODY    = [0x50, 0x8C, 0xE6, 255];
  const BELLY   = [0xE6, 0xDC, 0xC8, 255];
  const CAP     = [0xC8, 0x3C, 0x32, 255];
  const CAP_HI  = [0xE0, 0x50, 0x42, 255];
  const SHOE    = [0xC8, 0x3C, 0x32, 255];
  const EYE_W   = [0xFF, 0xFF, 0xFF, 255];
  const PUPIL   = [0x10, 0x10, 0x18, 255];
  const SKIN    = [0xF0, 0xC8, 0xA0, 255];

  function drawBaseCharacter(t, opts = {}) {
    const {
      shiftY = 0,
      leftLegFwd = 0, rightLegFwd = 0,
      leftArmFwd = 0, rightArmFwd = 0,
      armsUp = false, legsTucked = false, armsOut = false,
      squishEyes = false, xEyes = false, upsideDown = false,
      redTint = false, legsDangle = false,
    } = opts;

    const sy = shiftY;

    if (upsideDown) {
      // Draw upside down version
      // Cap at bottom
      t.fill(4, 12 + sy, 8, 3, ...CAP);
      t.fill(5, 11 + sy, 6, 1, ...CAP);
      // brim
      t.fill(3, 15 + sy, 10, 1, ...CAP);

      // Body
      t.fill(4, 4 + sy, 8, 8, ...BODY);
      t.fill(5, 3 + sy, 6, 1, ...BODY);
      // Belly
      t.fill(5, 6 + sy, 6, 4, ...BELLY);
      // X eyes
      t.set(5, 7 + sy, ...PUPIL);
      t.set(7, 7 + sy, ...PUPIL);
      t.set(6, 8 + sy, ...PUPIL);
      t.set(9, 7 + sy, ...PUPIL);
      t.set(11, 7 + sy, ...PUPIL);
      t.set(10, 8 + sy, ...PUPIL);
      // Shoes at top
      t.fill(4, 1 + sy, 3, 2, ...SHOE);
      t.fill(9, 1 + sy, 3, 2, ...SHOE);
      // Outline
      for (let x = 4; x < 12; x++) t.set(x, 3 + sy, ...OUTLINE);
      for (let x = 3; x < 13; x++) t.set(x, 15 + sy, ...OUTLINE);
      for (let y = 3; y <= 15; y++) { t.set(3, y + sy, ...OUTLINE); t.set(12, y + sy, ...OUTLINE); }
      return;
    }

    // ── Cap ──
    t.fill(4, 1 + sy, 8, 3, ...CAP);
    t.fill(5, 4 + sy, 6, 1, ...CAP);
    // cap highlight
    t.set(5, 1 + sy, ...CAP_HI);
    t.set(6, 1 + sy, ...CAP_HI);
    // brim
    t.fill(3, 1 + sy, 1, 2, ...CAP);
    t.fill(12, 1 + sy, 1, 1, ...CAP);

    // ── Body ──
    t.fill(4, 4 + sy, 8, 8, ...BODY);
    t.fill(5, 12 + sy, 6, 1, ...BODY);

    // ── Belly ──
    t.fill(5, 7 + sy, 6, 4, ...BELLY);

    // ── Eyes ──
    if (squishEyes) {
      // squished horizontal line eyes
      t.fill(5, 7 + sy, 2, 1, ...EYE_W);
      t.fill(9, 7 + sy, 2, 1, ...EYE_W);
      t.set(5, 7 + sy, ...PUPIL);
      t.set(10, 7 + sy, ...PUPIL);
    } else if (xEyes) {
      t.set(5, 6 + sy, ...PUPIL);
      t.set(7, 6 + sy, ...PUPIL);
      t.set(6, 7 + sy, ...PUPIL);
      t.set(9, 6 + sy, ...PUPIL);
      t.set(11, 6 + sy, ...PUPIL);
      t.set(10, 7 + sy, ...PUPIL);
    } else {
      // white of eyes
      t.fill(5, 5 + sy, 2, 3, ...EYE_W);
      t.fill(9, 5 + sy, 2, 3, ...EYE_W);
      // pupils (look right)
      t.set(6, 6 + sy, ...PUPIL);
      t.set(6, 7 + sy, ...PUPIL);
      t.set(10, 6 + sy, ...PUPIL);
      t.set(10, 7 + sy, ...PUPIL);
    }

    // ── Arms ──
    if (armsUp) {
      // arms raised
      t.fill(3, 3 + sy, 1, 4, ...BODY);
      t.fill(2, 2 + sy, 1, 2, ...BODY);
      t.fill(12, 3 + sy, 1, 4, ...BODY);
      t.fill(13, 2 + sy, 1, 2, ...BODY);
      // hands
      t.set(2, 2 + sy, ...SKIN);
      t.set(13, 2 + sy, ...SKIN);
    } else if (armsOut) {
      // arms out to sides
      t.fill(2, 6 + sy, 2, 2, ...BODY);
      t.fill(1, 5 + sy, 1, 2, ...BODY);
      t.fill(12, 6 + sy, 2, 2, ...BODY);
      t.fill(14, 5 + sy, 1, 2, ...BODY);
      t.set(1, 5 + sy, ...SKIN);
      t.set(14, 5 + sy, ...SKIN);
    } else {
      // arms at sides, with possible forward motion
      if (leftArmFwd) {
        t.fill(3, 6 + sy, 1, 3, ...BODY);
        t.fill(2, 8 + sy, 1, 2, ...BODY);
        t.set(2, 9 + sy, ...SKIN);
      } else {
        t.fill(3, 7 + sy, 1, 4, ...BODY);
        t.set(3, 10 + sy, ...SKIN);
      }
      if (rightArmFwd) {
        t.fill(12, 6 + sy, 1, 3, ...BODY);
        t.fill(13, 8 + sy, 1, 2, ...BODY);
        t.set(13, 9 + sy, ...SKIN);
      } else {
        t.fill(12, 7 + sy, 1, 4, ...BODY);
        t.set(12, 10 + sy, ...SKIN);
      }
    }

    // ── Legs / Shoes ──
    if (legsTucked) {
      // tucked up
      t.fill(5, 12 + sy, 2, 2, ...SHOE);
      t.fill(9, 12 + sy, 2, 2, ...SHOE);
    } else if (legsDangle) {
      // dangling
      t.fill(5, 12 + sy, 2, 3, ...BODY);
      t.fill(9, 12 + sy, 2, 3, ...BODY);
      t.fill(5, 14 + sy, 2, 1, ...SHOE);
      t.fill(9, 14 + sy, 2, 1, ...SHOE);
    } else {
      // normal standing or running
      const leftX = leftLegFwd ? 3 : 4;
      const rightX = rightLegFwd ? 10 : 9;
      t.fill(leftX, 12 + sy, 3, 2, ...BODY);
      t.fill(leftX, 14 + sy, 3, 1, ...SHOE);
      t.fill(rightX, 12 + sy, 3, 2, ...BODY);
      t.fill(rightX, 14 + sy, 3, 1, ...SHOE);
    }

    // ── Outline ──
    // top of cap
    for (let x = 4; x < 12; x++) t.set(x, 0 + sy, ...OUTLINE);
    t.set(3, 1 + sy, ...OUTLINE);
    t.set(12, 2 + sy, ...OUTLINE);
    // sides
    for (let y = 1; y <= 3; y++) t.set(3, y + sy, ...OUTLINE);
    for (let y = 4; y <= 11; y++) {
      if (!armsUp && !armsOut) {
        // outline on arm positions varies
      }
    }

    // red tint overlay
    if (redTint) {
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          // We can't easily read from tile, so we just add red overlay pixels on body
        }
      }
    }
  }

  // Frame 0: idle1 - standing straight
  drawInTile(img, 0, 0, (t) => {
    drawBaseCharacter(t, {});
  });

  // Frame 1: idle2 - bob 1px down
  drawInTile(img, 1, 0, (t) => {
    drawBaseCharacter(t, { shiftY: 1 });
  });

  // Frame 2: run1 - left leg fwd, right arm fwd
  drawInTile(img, 2, 0, (t) => {
    drawBaseCharacter(t, { leftLegFwd: 1, rightArmFwd: 1 });
  });

  // Frame 3: run2 - legs together, arms neutral
  drawInTile(img, 3, 0, (t) => {
    drawBaseCharacter(t, {});
  });

  // Frame 4: run3 - right leg fwd, left arm fwd
  drawInTile(img, 4, 0, (t) => {
    drawBaseCharacter(t, { rightLegFwd: 1, leftArmFwd: 1 });
  });

  // Frame 5: run4 - slight bob variation
  drawInTile(img, 5, 0, (t) => {
    drawBaseCharacter(t, { shiftY: -1 });
  });

  // Frame 6: jump - arms up, legs tucked
  drawInTile(img, 6, 0, (t) => {
    drawBaseCharacter(t, { armsUp: true, legsTucked: true });
  });

  // Frame 7: fall - arms out, legs dangling
  drawInTile(img, 7, 0, (t) => {
    drawBaseCharacter(t, { armsOut: true, legsDangle: true });
  });

  // Frame 8: hurt - squished eyes (red tint applied as overlay)
  drawInTile(img, 8, 0, (t) => {
    drawBaseCharacter(t, { squishEyes: true });
    // Apply red tint by setting some body pixels redder
    // Overlay red pixels on the body area
    for (let py = 4; py < 12; py++) {
      for (let px = 4; px < 12; px++) {
        const ox = 8 * 16 + px;
        const [r, g, b, a] = getPixel(img, ox, py);
        if (a > 0) {
          setPixel(img, ox, py, Math.min(255, r + 60), Math.max(0, g - 30), Math.max(0, b - 30), a);
        }
      }
    }
  });

  // Frame 9: dead - upside down, X eyes
  drawInTile(img, 9, 0, (t) => {
    drawBaseCharacter(t, { upsideDown: true, xEyes: true });
  });

  savePNG(img, 'assets/sprites/player.png');
}

// ───────────────────────────────────────────────────────
// 3. ENEMIES SPRITE SHEET (64x48, 4 cols x 3 rows of 16x16)
// ───────────────────────────────────────────────────────
function generateEnemies() {
  const img = createImageBuffer(64, 48);

  const WALKER_BODY = [0xB4, 0x3C, 0x32, 255];
  const WALKER_SPOT = [0xFF, 0xE6, 0xC8, 255];
  const WALKER_CAP  = [0xE6, 0x50, 0x3C, 255];
  const WALKER_DARK = [0x82, 0x28, 0x1E, 255];
  const EYE_W = [0xFF, 0xFF, 0xFF, 255];
  const PUPIL = [0x10, 0x10, 0x18, 255];
  const FOOT  = [0x50, 0x32, 0x28, 255];

  // ── Row 0: Walker (mushroom) ──

  function drawWalker(t, opts = {}) {
    const { leftFoot = false, rightFoot = false, squished = false, idle = false } = opts;

    if (squished) {
      // flattened mushroom
      t.fill(2, 10, 12, 3, ...WALKER_BODY);
      t.fill(1, 10, 14, 2, ...WALKER_CAP);
      // spots
      t.set(4, 10, ...WALKER_SPOT);
      t.set(9, 10, ...WALKER_SPOT);
      // eyes (squished)
      t.fill(5, 12, 1, 1, ...PUPIL);
      t.fill(10, 12, 1, 1, ...PUPIL);
      // feet
      t.fill(3, 13, 3, 1, ...FOOT);
      t.fill(10, 13, 3, 1, ...FOOT);
      return;
    }

    // Mushroom cap (dome)
    t.fill(3, 1, 10, 4, ...WALKER_CAP);
    t.fill(2, 2, 12, 3, ...WALKER_CAP);
    t.fill(4, 0, 8, 1, ...WALKER_CAP);
    // spots on cap
    t.set(5, 1, ...WALKER_SPOT);
    t.set(6, 1, ...WALKER_SPOT);
    t.set(9, 2, ...WALKER_SPOT);
    t.set(10, 2, ...WALKER_SPOT);
    t.set(4, 3, ...WALKER_SPOT);

    // stem/body
    t.fill(4, 5, 8, 6, ...WALKER_BODY);
    t.fill(5, 11, 6, 2, ...WALKER_BODY);

    // eyes
    t.fill(5, 6, 2, 2, ...EYE_W);
    t.fill(9, 6, 2, 2, ...EYE_W);
    t.set(6, 7, ...PUPIL);
    t.set(10, 7, ...PUPIL);

    // angry brow
    t.set(5, 5, ...WALKER_DARK);
    t.set(10, 5, ...WALKER_DARK);

    // mouth
    t.fill(6, 9, 4, 1, ...WALKER_DARK);

    // feet
    if (leftFoot) {
      t.fill(3, 13, 3, 2, ...FOOT);
      t.fill(8, 12, 3, 2, ...FOOT);
    } else if (rightFoot) {
      t.fill(5, 12, 3, 2, ...FOOT);
      t.fill(10, 13, 3, 2, ...FOOT);
    } else {
      t.fill(4, 13, 3, 2, ...FOOT);
      t.fill(9, 13, 3, 2, ...FOOT);
    }
  }

  drawInTile(img, 0, 0, (t) => drawWalker(t, { leftFoot: true }));
  drawInTile(img, 1, 0, (t) => drawWalker(t, { rightFoot: true }));
  drawInTile(img, 2, 0, (t) => drawWalker(t, { squished: true }));
  drawInTile(img, 3, 0, (t) => drawWalker(t, { idle: true }));

  // ── Row 1: Flyer (bee) ──
  const BEE_BODY   = [0xC8, 0xB4, 0x32, 255];
  const BEE_STRIPE = [0x28, 0x28, 0x28, 255];
  const BEE_WING   = [0xD0, 0xE0, 0xF0, 180];
  const BEE_EYE    = [0xFF, 0xFF, 0xFF, 255];

  function drawBee(t, opts = {}) {
    const { wingsUp = false, wingsDown = false, alert = false } = opts;

    // body (elliptical)
    t.ellipse(8, 9, 5, 4, ...BEE_BODY);
    // stripes
    t.fill(4, 8, 8, 1, ...BEE_STRIPE);
    t.fill(4, 10, 8, 1, ...BEE_STRIPE);

    // eyes
    t.fill(5, 6, 2, 2, ...BEE_EYE);
    t.fill(9, 6, 2, 2, ...BEE_EYE);
    t.set(6, 7, ...PUPIL);
    t.set(10, 7, ...PUPIL);

    if (alert) {
      // bigger eyes
      t.fill(4, 5, 3, 3, ...BEE_EYE);
      t.fill(9, 5, 3, 3, ...BEE_EYE);
      t.set(5, 6, ...PUPIL);
      t.set(6, 7, ...PUPIL);
      t.set(10, 6, ...PUPIL);
      t.set(11, 7, ...PUPIL);
    }

    // antenna
    t.set(5, 4, ...BEE_STRIPE);
    t.set(4, 3, ...BEE_STRIPE);
    t.set(11, 4, ...BEE_STRIPE);
    t.set(12, 3, ...BEE_STRIPE);
    // antenna tips
    t.set(4, 2, ...BEE_BODY);
    t.set(12, 2, ...BEE_BODY);

    // stinger
    t.set(8, 13, ...BEE_STRIPE);
    t.set(8, 14, ...BEE_STRIPE);

    // wings
    if (wingsUp) {
      t.fill(3, 1, 4, 4, ...BEE_WING);
      t.fill(9, 1, 4, 4, ...BEE_WING);
    } else if (wingsDown) {
      t.fill(3, 6, 3, 4, ...BEE_WING);
      t.fill(10, 6, 3, 4, ...BEE_WING);
    } else {
      t.fill(3, 3, 4, 4, ...BEE_WING);
      t.fill(9, 3, 4, 4, ...BEE_WING);
    }
  }

  drawInTile(img, 0, 1, (t) => drawBee(t, { wingsUp: true }));
  drawInTile(img, 1, 1, (t) => drawBee(t, { wingsDown: true }));
  drawInTile(img, 2, 1, (t) => drawBee(t, { alert: true }));
  drawInTile(img, 3, 1, (t) => drawBee(t, {}));

  // ── Row 2: Chaser (purple spiked) ──
  const CHASER_BODY  = [0x82, 0x32, 0x96, 255];
  const CHASER_LIGHT = [0xA0, 0x50, 0xB4, 255];
  const CHASER_DARK  = [0x5A, 0x1E, 0x6E, 255];
  const CHASER_SPIKE = [0x50, 0x28, 0x64, 255];

  function drawChaser(t, opts = {}) {
    const { runLeft = false, runRight = false, alert = false, sitting = false } = opts;

    const bodyY = sitting ? 2 : 0;

    // spikes on top
    t.set(4, bodyY + 0, ...CHASER_SPIKE);
    t.set(8, bodyY + 0, ...CHASER_SPIKE);
    t.set(12, bodyY + 0, ...CHASER_SPIKE);
    t.set(3, bodyY + 1, ...CHASER_SPIKE);
    t.set(5, bodyY + 1, ...CHASER_SPIKE);
    t.set(7, bodyY + 1, ...CHASER_SPIKE);
    t.set(9, bodyY + 1, ...CHASER_SPIKE);
    t.set(11, bodyY + 1, ...CHASER_SPIKE);
    t.set(13, bodyY + 1, ...CHASER_SPIKE);

    // body
    t.fill(3, bodyY + 2, 10, 8, ...CHASER_BODY);
    t.fill(4, bodyY + 10, 8, 2, ...CHASER_BODY);
    // lighter belly
    t.fill(5, bodyY + 7, 6, 3, ...CHASER_LIGHT);

    // eyes
    if (alert) {
      // wide eyes
      t.fill(4, bodyY + 3, 3, 3, ...EYE_W);
      t.fill(9, bodyY + 3, 3, 3, ...EYE_W);
      t.set(5, bodyY + 4, ...PUPIL);
      t.set(6, bodyY + 5, ...PUPIL);
      t.set(10, bodyY + 4, ...PUPIL);
      t.set(11, bodyY + 5, ...PUPIL);
    } else {
      t.fill(4, bodyY + 4, 2, 2, ...EYE_W);
      t.fill(10, bodyY + 4, 2, 2, ...EYE_W);
      t.set(5, bodyY + 5, ...PUPIL);
      t.set(11, bodyY + 5, ...PUPIL);
    }

    // angry mouth
    t.fill(6, bodyY + 7, 4, 1, ...CHASER_DARK);
    t.set(6, bodyY + 8, ...CHASER_DARK);
    t.set(9, bodyY + 8, ...CHASER_DARK);

    // feet
    if (sitting) {
      t.fill(4, bodyY + 12, 3, 2, ...CHASER_DARK);
      t.fill(9, bodyY + 12, 3, 2, ...CHASER_DARK);
    } else if (runLeft) {
      t.fill(2, bodyY + 12, 3, 2, ...CHASER_DARK);
      t.fill(8, bodyY + 11, 3, 2, ...CHASER_DARK);
    } else if (runRight) {
      t.fill(5, bodyY + 11, 3, 2, ...CHASER_DARK);
      t.fill(11, bodyY + 12, 3, 2, ...CHASER_DARK);
    } else {
      t.fill(4, bodyY + 12, 3, 2, ...CHASER_DARK);
      t.fill(9, bodyY + 12, 3, 2, ...CHASER_DARK);
    }
  }

  drawInTile(img, 0, 2, (t) => drawChaser(t, { runLeft: true }));
  drawInTile(img, 1, 2, (t) => drawChaser(t, { runRight: true }));
  drawInTile(img, 2, 2, (t) => drawChaser(t, { alert: true }));
  drawInTile(img, 3, 2, (t) => drawChaser(t, { sitting: true }));

  savePNG(img, 'assets/sprites/enemies.png');
}

// ───────────────────────────────────────────────────────
// 4. ITEMS SPRITE SHEET (144x16, 9 frames of 16x16)
// ───────────────────────────────────────────────────────
function generateItems() {
  const img = createImageBuffer(144, 16);

  const GOLD   = [0xFF, 0xD2, 0x32, 255];
  const GOLD_H = [0xFF, 0xF5, 0xB4, 255];
  const GOLD_D = [0xC8, 0xA0, 0x14, 255];

  // Frame 0: coin1 - full circle
  drawInTile(img, 0, 0, (t) => {
    t.circle(8, 8, 6, ...GOLD, true);
    t.circle(8, 8, 4, ...GOLD_H, true);
    t.circle(8, 8, 3, ...GOLD, true);
    // shine
    t.set(5, 5, ...GOLD_H);
    t.set(6, 4, ...GOLD_H);
    // inner detail: $ or letter
    t.fill(7, 5, 2, 1, ...GOLD_D);
    t.fill(6, 6, 2, 1, ...GOLD_D);
    t.fill(7, 7, 2, 1, ...GOLD_D);
    t.fill(8, 8, 2, 1, ...GOLD_D);
    t.fill(7, 9, 2, 1, ...GOLD_D);
  });

  // Frame 1: coin2 - 3/4 view (narrower)
  drawInTile(img, 1, 0, (t) => {
    t.ellipse(8, 8, 4, 6, ...GOLD);
    t.ellipse(8, 8, 3, 5, ...GOLD_H);
    t.ellipse(8, 8, 2, 4, ...GOLD);
    t.set(6, 5, ...GOLD_H);
  });

  // Frame 2: coin3 - thin side view
  drawInTile(img, 2, 0, (t) => {
    t.fill(7, 2, 2, 12, ...GOLD);
    t.fill(7, 3, 2, 10, ...GOLD_H);
    t.fill(7, 4, 2, 8, ...GOLD);
    t.set(7, 3, ...GOLD_H);
  });

  // Frame 3: coin4 - other 3/4 view
  drawInTile(img, 3, 0, (t) => {
    t.ellipse(8, 8, 4, 6, ...GOLD);
    t.ellipse(8, 8, 3, 5, ...GOLD_H);
    t.ellipse(8, 8, 2, 4, ...GOLD);
    t.set(10, 5, ...GOLD_H);
  });

  // Frame 4: gem - blue diamond
  drawInTile(img, 4, 0, (t) => {
    const GEM  = [0x32, 0x96, 0xFF, 255];
    const GEM_L = [0x64, 0xB4, 0xFF, 255];
    const GEM_D = [0x1E, 0x64, 0xC8, 255];
    // diamond shape
    t.triangle(8, 1, 2, 8, 8, 14, ...GEM);
    t.triangle(8, 1, 14, 8, 8, 14, ...GEM_L);
    // facet lines
    t.line(8, 1, 2, 8, ...GEM_D);
    t.line(8, 1, 14, 8, ...GEM_D);
    t.line(2, 8, 8, 14, ...GEM_D);
    t.line(14, 8, 8, 14, ...GEM_D);
    // center line
    t.line(8, 1, 8, 14, ...GEM_D);
    t.line(2, 8, 14, 8, ...GEM_D);
    // sparkle
    t.set(5, 5, 0xFF, 0xFF, 0xFF);
    t.set(6, 4, 0xFF, 0xFF, 0xFF);
  });

  // Frame 5: spring-normal
  drawInTile(img, 5, 0, (t) => {
    const METAL = [0x80, 0x88, 0x90, 255];
    const METAL_H = [0xB0, 0xB8, 0xC0, 255];
    const METAL_D = [0x50, 0x58, 0x60, 255];
    // base
    t.fill(3, 14, 10, 2, ...METAL_D);
    // top platform
    t.fill(3, 3, 10, 2, ...METAL);
    t.fill(3, 3, 10, 1, ...METAL_H);
    // coils
    for (let i = 0; i < 4; i++) {
      const y = 5 + i * 2;
      t.fill(4 + i % 2, y, 8 - i % 2, 1, ...METAL);
      t.fill(4 + (1 - i % 2), y + 1, 8 - (1 - i % 2), 1, ...METAL_D);
    }
  });

  // Frame 6: spring-compressed
  drawInTile(img, 6, 0, (t) => {
    const METAL = [0x80, 0x88, 0x90, 255];
    const METAL_H = [0xB0, 0xB8, 0xC0, 255];
    const METAL_D = [0x50, 0x58, 0x60, 255];
    // base
    t.fill(3, 14, 10, 2, ...METAL_D);
    // top platform (lower)
    t.fill(3, 9, 10, 2, ...METAL);
    t.fill(3, 9, 10, 1, ...METAL_H);
    // compressed coils
    for (let i = 0; i < 4; i++) {
      const y = 11 + i;
      t.fill(4 + i % 2, y, 8 - i % 2, 1, ...METAL);
    }
  });

  // Frame 7: flag-wave1
  drawInTile(img, 7, 0, (t) => {
    // pole
    t.fill(3, 0, 2, 16, 0x80, 0x80, 0x88);
    t.fill(3, 0, 2, 1, 0xA0, 0xA0, 0xA8);
    // ball on top
    t.set(3, 0, 0xFF, 0xD2, 0x32);
    t.set(4, 0, 0xFF, 0xD2, 0x32);
    // triangular banner pointing right
    t.triangle(5, 2, 14, 5, 5, 8, 0xE8, 0x30, 0x30);
    // banner highlight
    t.fill(6, 4, 3, 2, 0xFF, 0x50, 0x40);
  });

  // Frame 8: flag-wave2
  drawInTile(img, 8, 0, (t) => {
    // pole
    t.fill(3, 0, 2, 16, 0x80, 0x80, 0x88);
    t.fill(3, 0, 2, 1, 0xA0, 0xA0, 0xA8);
    t.set(3, 0, 0xFF, 0xD2, 0x32);
    t.set(4, 0, 0xFF, 0xD2, 0x32);
    // banner waving other direction (droopier)
    t.triangle(5, 2, 13, 6, 5, 9, 0xE8, 0x30, 0x30);
    t.fill(6, 5, 3, 2, 0xFF, 0x50, 0x40);
  });

  savePNG(img, 'assets/sprites/items.png');
}

// ───────────────────────────────────────────────────────
// 5. UI SPRITE SHEET (48x16, 3 x 16x16)
// ───────────────────────────────────────────────────────
function generateUI() {
  const img = createImageBuffer(48, 16);

  // Frame 0: heart-full
  drawInTile(img, 0, 0, (t) => {
    const R = [0xE8, 0x30, 0x30, 255];
    const H = [0xFF, 0x60, 0x60, 255];
    const D = [0xB0, 0x20, 0x20, 255];
    // heart shape pixel by pixel
    //   ##  ##
    //  ########
    //  ########
    //   ######
    //    ####
    //     ##
    const heart = [
      '  ##  ## ',
      ' ######## ',
      ' ######## ',
      '  ####### ',
      '   #####  ',
      '    ###   ',
      '     #    ',
    ];
    for (let row = 0; row < heart.length; row++) {
      for (let col = 0; col < heart[row].length; col++) {
        if (heart[row][col] === '#') {
          t.set(col + 3, row + 3, ...R);
        }
      }
    }
    // highlight
    t.set(5, 4, ...H);
    t.set(5, 5, ...H);
    // shadow
    t.set(9, 7, ...D);
    t.set(8, 8, ...D);
  });

  // Frame 1: heart-empty
  drawInTile(img, 1, 0, (t) => {
    const O = [0x60, 0x60, 0x68, 255];
    const heart = [
      '  ##  ## ',
      ' #    # #',
      ' #      #',
      '  #    # ',
      '   #  #  ',
      '    ##   ',
      '     #   ',
    ];
    for (let row = 0; row < heart.length; row++) {
      for (let col = 0; col < heart[row].length; col++) {
        if (heart[row][col] === '#') {
          t.set(col + 3, row + 3, ...O);
        }
      }
    }
  });

  // Frame 2: coin-icon (simplified coin)
  drawInTile(img, 2, 0, (t) => {
    const GOLD   = [0xFF, 0xD2, 0x32, 255];
    const GOLD_H = [0xFF, 0xF5, 0xB4, 255];
    t.circle(8, 8, 5, ...GOLD, true);
    t.circle(8, 8, 3, ...GOLD_H, true);
    t.circle(8, 8, 2, ...GOLD, true);
    t.set(6, 5, ...GOLD_H);
  });

  savePNG(img, 'assets/sprites/ui.png');
}

// ───────────────────────────────────────────────────────
// 6. BACKGROUND: MOUNTAINS (800x200)
// ───────────────────────────────────────────────────────
function generateMountains() {
  const W = 800, H = 200;
  const img = createImageBuffer(W, H);

  // Far mountains: muted blue-gray
  const farColor = hex('#6070A0');
  const farPeaks = [
    { x: 0, h: 80 }, { x: 80, h: 140 }, { x: 180, h: 100 },
    { x: 260, h: 155 }, { x: 370, h: 110 }, { x: 440, h: 145 },
    { x: 540, h: 90 }, { x: 620, h: 160 }, { x: 720, h: 120 },
    { x: 800, h: 80 },
  ];
  for (let x = 0; x < W; x++) {
    // find which segment we're in
    let leftPeak = farPeaks[0], rightPeak = farPeaks[1];
    for (let i = 0; i < farPeaks.length - 1; i++) {
      if (x >= farPeaks[i].x && x <= farPeaks[i + 1].x) {
        leftPeak = farPeaks[i];
        rightPeak = farPeaks[i + 1];
        break;
      }
    }
    const t = (x - leftPeak.x) / Math.max(1, rightPeak.x - leftPeak.x);
    // Triangle-ish interpolation: go up to peak then down
    const peakH = Math.max(leftPeak.h, rightPeak.h);
    const baseH = Math.min(leftPeak.h, rightPeak.h);
    // Use linear interp for angular mountains
    const mh = leftPeak.h + (rightPeak.h - leftPeak.h) * t;
    const topY = H - mh;
    for (let y = topY; y < H; y++) {
      setPixel(img, x, y, farColor[0], farColor[1], farColor[2], farColor[3]);
    }
  }

  // Near mountains: darker, in front, taller peaks
  const nearColor = hex('#506090');
  const nearPeaks = [
    { x: 0, h: 60 }, { x: 100, h: 120 }, { x: 200, h: 70 },
    { x: 300, h: 170 }, { x: 420, h: 90 }, { x: 500, h: 160 },
    { x: 600, h: 100 }, { x: 700, h: 140 }, { x: 800, h: 70 },
  ];
  for (let x = 0; x < W; x++) {
    let leftPeak = nearPeaks[0], rightPeak = nearPeaks[1];
    for (let i = 0; i < nearPeaks.length - 1; i++) {
      if (x >= nearPeaks[i].x && x <= nearPeaks[i + 1].x) {
        leftPeak = nearPeaks[i];
        rightPeak = nearPeaks[i + 1];
        break;
      }
    }
    const t = (x - leftPeak.x) / Math.max(1, rightPeak.x - leftPeak.x);
    const mh = leftPeak.h + (rightPeak.h - leftPeak.h) * t;
    const topY = H - mh;
    for (let y = topY; y < H; y++) {
      setPixel(img, x, y, nearColor[0], nearColor[1], nearColor[2], nearColor[3]);
    }
  }

  savePNG(img, 'assets/sprites/bg_mountains.png');
}

// ───────────────────────────────────────────────────────
// 7. BACKGROUND: HILLS (800x150)
// ───────────────────────────────────────────────────────
function generateHills() {
  const W = 800, H = 150;
  const img = createImageBuffer(W, H);

  const hillColor = hex('#1A6020');
  const treeColor = hex('#0E4014');

  // Multiple rolling hills using sine waves
  function hillHeight(x) {
    return 50
      + 30 * Math.sin(x * 0.008)
      + 20 * Math.sin(x * 0.015 + 1)
      + 10 * Math.sin(x * 0.03 + 2);
  }

  for (let x = 0; x < W; x++) {
    const hh = hillHeight(x);
    const topY = H - hh;
    for (let y = topY; y < H; y++) {
      setPixel(img, x, y, hillColor[0], hillColor[1], hillColor[2], hillColor[3]);
    }
  }

  // Simple tree silhouettes on top of hills
  const treePositions = [50, 130, 220, 310, 400, 480, 570, 650, 740];
  for (const tx of treePositions) {
    const hh = hillHeight(tx);
    const baseY = H - hh;
    // trunk
    for (let dy = -12; dy < 0; dy++) {
      setPixel(img, tx, baseY + dy, treeColor[0], treeColor[1], treeColor[2], treeColor[3]);
      setPixel(img, tx + 1, baseY + dy, treeColor[0], treeColor[1], treeColor[2], treeColor[3]);
    }
    // canopy (triangle)
    for (let dy = -25; dy <= -10; dy++) {
      const width = Math.floor((-10 - dy) * 0.8) + 1;
      for (let dx = -width; dx <= width; dx++) {
        const px = tx + dx;
        const py = baseY + dy;
        if (px >= 0 && px < W && py >= 0 && py < H) {
          setPixel(img, px, py, treeColor[0], treeColor[1], treeColor[2], treeColor[3]);
        }
      }
    }
  }

  savePNG(img, 'assets/sprites/bg_hills.png');
}

// ───────────────────────────────────────────────────────
// 8. BACKGROUND: CLOUDS (128x32, 4 cloud shapes of 32x32)
// ───────────────────────────────────────────────────────
function generateClouds() {
  const img = createImageBuffer(128, 32);

  const W1 = [0xF0, 0xF0, 0xFF, 200];
  const W2 = [0xE0, 0xE8, 0xF8, 180];

  function drawCloud(ox, oy, circles) {
    for (const [cx, cy, r, colorIdx] of circles) {
      const color = colorIdx === 0 ? W1 : W2;
      drawCircle(img, ox + cx, oy + cy, r, color[0], color[1], color[2], color[3], true);
    }
  }

  // Cloud 0: large puffy
  drawCloud(0, 0, [
    [16, 22, 8, 1],  // base
    [10, 18, 7, 1],
    [22, 18, 7, 1],
    [12, 14, 6, 0],  // top lumps
    [20, 14, 5, 0],
    [16, 12, 6, 0],
  ]);

  // Cloud 1: small round
  drawCloud(32, 0, [
    [16, 20, 7, 1],
    [12, 16, 5, 0],
    [20, 16, 5, 0],
    [16, 14, 5, 0],
  ]);

  // Cloud 2: long flat
  drawCloud(64, 0, [
    [8, 22, 6, 1],
    [16, 22, 6, 1],
    [24, 22, 6, 1],
    [12, 18, 5, 0],
    [20, 18, 5, 0],
    [16, 16, 4, 0],
  ]);

  // Cloud 3: tiny wisp
  drawCloud(96, 0, [
    [16, 22, 5, 1],
    [12, 19, 4, 0],
    [20, 19, 4, 0],
    [16, 17, 3, 0],
  ]);

  savePNG(img, 'assets/sprites/bg_clouds.png');
}

// ===================================================================
// SOUND GENERATION
// ===================================================================

// 1. jump.wav — Rising sine chirp 300->600Hz over 0.12s
function generateJump() {
  const dur = 0.12;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = linearInterp(t, dur, 300, 600);
    const amp = 1 - t / dur; // decay
    samples[i] = 0.6 * amp * sineWave(t, freq);
  }
  saveWAV(samples, 'assets/sounds/jump.wav');
}

// 2. coin.wav — Two-tone ding: 800Hz 0.05s then 1200Hz 0.05s
function generateCoin() {
  const dur = 0.10;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = t < 0.05 ? 800 : 1200;
    const localT = t < 0.05 ? t : t - 0.05;
    const amp = 1 - localT / 0.05;
    samples[i] = 0.5 * amp * sineWave(t, freq);
  }
  saveWAV(samples, 'assets/sounds/coin.wav');
}

// 3. stomp.wav — Low thud: 150Hz sine + noise, 0.08s, fast decay
function generateStomp() {
  const dur = 0.08;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const amp = Math.pow(1 - t / dur, 3);
    samples[i] = 0.7 * amp * (0.7 * sineWave(t, 150) + 0.3 * noise());
  }
  saveWAV(samples, 'assets/sounds/stomp.wav');
}

// 4. hurt.wav — Descending square wave buzz: 400->150Hz over 0.2s
function generateHurt() {
  const dur = 0.2;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const freq = linearInterp(t, dur, 400, 150);
    const amp = 1 - 0.5 * (t / dur);
    samples[i] = 0.4 * amp * squareWave(t, freq);
  }
  saveWAV(samples, 'assets/sounds/hurt.wav');
}

// 5. spring.wav — Bouncy boing: 400Hz sine ±100Hz vibrato, 0.15s
function generateSpring() {
  const dur = 0.15;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const vibrato = 100 * Math.sin(2 * Math.PI * 30 * t);
    const freq = 400 + vibrato;
    const amp = 1 - t / dur;
    samples[i] = 0.5 * amp * sineWave(t, freq);
  }
  saveWAV(samples, 'assets/sounds/spring.wav');
}

// 6. death.wav — Sad descending: 500->100Hz sine over 0.4s with vibrato
function generateDeath() {
  const dur = 0.4;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const baseFreq = linearInterp(t, dur, 500, 100);
    const vibrato = 15 * Math.sin(2 * Math.PI * 6 * t);
    const freq = baseFreq + vibrato;
    const amp = 1 - 0.6 * (t / dur);
    samples[i] = 0.5 * amp * sineWave(t, freq);
  }
  saveWAV(samples, 'assets/sounds/death.wav');
}

// 7. gem.wav — Sparkly arpeggio: 600, 900, 1200Hz each 0.06s
function generateGem() {
  const noteDur = 0.06;
  const dur = noteDur * 3;
  const samples = makeSamples(dur);
  const freqs = [600, 900, 1200];
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const noteIdx = Math.min(2, Math.floor(t / noteDur));
    const localT = t - noteIdx * noteDur;
    const amp = 1 - localT / noteDur;
    samples[i] = 0.5 * amp * sineWave(t, freqs[noteIdx]);
  }
  saveWAV(samples, 'assets/sounds/gem.wav');
}

// 8. complete.wav — Triumphant scale: C5-E5-G5-C6-E6 each 0.1s
function generateComplete() {
  const noteDur = 0.1;
  const dur = noteDur * 5;
  const samples = makeSamples(dur);
  // C5=523.25, E5=659.25, G5=783.99, C6=1046.50, E6=1318.51
  const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const noteIdx = Math.min(4, Math.floor(t / noteDur));
    const localT = t - noteIdx * noteDur;
    const amp = 0.8 * (1 - 0.5 * localT / noteDur); // gentle decay
    samples[i] = 0.5 * amp * sineWave(t, freqs[noteIdx]);
  }
  saveWAV(samples, 'assets/sounds/complete.wav');
}

// 9. select.wav — Short UI click: 800Hz square, 0.03s
function generateSelect() {
  const dur = 0.03;
  const samples = makeSamples(dur);
  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;
    const amp = 1 - t / dur;
    samples[i] = 0.3 * amp * squareWave(t, 800);
  }
  saveWAV(samples, 'assets/sounds/select.wav');
}

// ===================================================================
// MAIN
// ===================================================================
function main() {
  console.log('');
  console.log('=== Bloom Jump Asset Generator ===');
  console.log('');

  console.log('Generating sprite sheets...');
  generateTileset();
  generatePlayer();
  generateEnemies();
  generateItems();
  generateUI();

  console.log('');
  console.log('Generating background images...');
  generateMountains();
  generateHills();
  generateClouds();

  console.log('');
  console.log('Generating sound effects...');
  generateJump();
  generateCoin();
  generateStomp();
  generateHurt();
  generateSpring();
  generateDeath();
  generateGem();
  generateComplete();
  generateSelect();

  console.log('');
  console.log('All assets generated successfully!');
  console.log('');
}

main();
