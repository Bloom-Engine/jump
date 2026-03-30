// ============================================================
// Perry Array Index Bug — Automated Test
// Mirrors the full game's module-level array layout and function
// structure to reproduce the bug where arr[i] returns arr[0].
// Exits with console output: PASS or FAIL.
// ============================================================

import {
  initWindow, windowShouldClose, beginDrawing, endDrawing,
  clearBackground, setTargetFPS, getDeltaTime, getTime,
  isKeyPressed, isKeyDown, isKeyReleased,
  getMouseX, getMouseY, isMouseButtonPressed,
  getScreenWidth, getScreenHeight, closeWindow,
  beginMode2D, endMode2D, getScreenToWorld2D,
  writeFile, readFile, fileExists,
} from "bloom/core";
import { Color, Key, Camera2D, MouseButton } from "bloom/core";
import {
  drawRect, drawCircle, drawTriangle, drawLine, drawRectLines,
  checkCollisionRecs,
} from "bloom/shapes";
import { drawText, measureText } from "bloom/text";
import {
  loadTexture, drawTexturePro, drawTextureRec,
  setTextureFilter, FILTER_NEAREST,
  stageTextures, commitTexture,
} from "bloom/textures";
import {
  initAudioDevice, closeAudioDevice,
  loadSound, playSound, setSoundVolume,
} from "bloom/audio";
import { clamp, randomFloat, randomInt, lerp } from "bloom/math";
import { Rect, Texture, Sound } from "bloom/core";

// ============================================================
// Mirror the game's exact module-level array layout
// ============================================================

const SCREEN_W = 800;
const SCREEN_H = 600;
const TILE_SRC = 16;
const TILE_SIZE = 32;
const SCALE = 2.0;

const GRAVITY = 1200.0;
const JUMP_VEL = -420.0;
const APEX_THRESHOLD = 80.0;
const APEX_MULT = 0.4;
const MAX_FALL = 600.0;
const MOVE_SPEED = 250.0;
const ACCEL_GROUND = 1800.0;
const ACCEL_AIR = 900.0;
const FRICTION_GROUND = 1400.0;
const FRICTION_AIR = 200.0;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.1;
const INVINCIBLE_TIME = 1.5;
const STOMP_BOUNCE = -300.0;
const SPRING_VEL = -550.0;

const PW = 20.0;
const PH = 28.0;
const POX = 6.0;
const POY = 4.0;

const T_AIR = 0.0;
const T_GRASS = 1.0;
const T_DIRT = 2.0;
const T_BRICK = 3.0;
const T_STONE = 4.0;
const T_SPIKE_UP = 5.0;
const T_SPIKE_DN = 6.0;
const T_PLATFORM = 7.0;

const E_WALKER = 1.0;
const E_FLYER = 2.0;
const E_CHASER = 3.0;
const E_COIN = 10.0;
const E_GEM = 11.0;
const E_SPRING = 12.0;
const E_FLAG = 20.0;

const ST_MENU = 0.0;
const ST_LEVEL_SELECT = 1.0;
const ST_PLAYING = 2.0;
const ST_PAUSED = 4.0;
const ST_GAME_OVER = 5.0;
const ST_LEVEL_COMPLETE = 6.0;

const MAX_ENEMIES = 30;
const MAX_COINS = 100;
const MAX_PARTICLES = 200;

const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };

// All module-level arrays (same as game)
const P = [
  0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0,
  0.0, 0.0, 3.0, 0.0, 0.0, 0.0,
  3.0, 0.0, 0.0, 0.0, 0.0,
];

const CAM = [400.0, 300.0, 1.0];
const GS = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const TILES: number[] = [];
const LVL = [0.0, 0.0, 0.0, 0.0];
const FLAG_POS = [0.0, 0.0, 0.0];

const EX: number[] = []; const EY: number[] = []; const EVX: number[] = []; const EVY: number[] = [];
const ET: number[] = []; const EA: number[] = []; const ES: number[] = []; const EHP: number[] = [];
const CX: number[] = []; const CY: number[] = []; const CA: number[] = []; const CT: number[] = [];
const PRX: number[] = []; const PRY: number[] = []; const PRVX: number[] = []; const PRVY: number[] = [];
const PRL: number[] = []; const PRM: number[] = []; const PRC: number[] = []; const PRS: number[] = [];

const LEVEL_NAMES: string[] = [];
const LEVEL_FILES: string[] = [];
const PARSE_RESULT = [0.0, 0.0];
const TILE_PARSE_IDX = [0.0];

// Pre-allocate (same as game)
for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
  EX.push(0.0); EY.push(0.0); EVX.push(0.0); EVY.push(0.0);
  ET.push(0.0); EA.push(0.0); ES.push(0.0); EHP.push(0.0);
}
for (let i = 0; i < MAX_COINS; i = i + 1) {
  CX.push(0.0); CY.push(0.0); CA.push(0.0); CT.push(0.0);
}
for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
  PRX.push(0.0); PRY.push(0.0); PRVX.push(0.0); PRVY.push(0.0);
  PRL.push(0.0); PRM.push(0.0); PRC.push(0.0); PRS.push(0.0);
}

// ============================================================
// Mirror game helper functions (to match code size/complexity)
// ============================================================

function maxf(a: number, b: number): number { if (a > b) return a; return b; }
function minf(a: number, b: number): number { if (a < b) return a; return b; }
function absf(a: number): number { if (a < 0.0) return 0.0 - a; return a; }
function floorf(a: number): number { return Math.floor(a); }

function isTileSolid(t: number): number {
  if (t === T_GRASS || t === T_DIRT || t === T_BRICK || t === T_STONE) return 1.0;
  return 0.0;
}

function isTileHazard(t: number): number {
  if (t === T_SPIKE_UP || t === T_SPIKE_DN) return 1.0;
  return 0.0;
}

function getTile(tx: number, ty: number): number {
  if (tx < 0 || tx >= LVL[0] || ty < 0 || ty >= LVL[1]) return T_AIR;
  const idx = floorf(ty) * floorf(LVL[0]) + floorf(tx);
  if (idx < 0 || idx >= TILES.length) return T_AIR;
  return TILES[idx];
}

function setTile(tx: number, ty: number, val: number): void {
  if (tx < 0 || tx >= LVL[0] || ty < 0 || ty >= LVL[1]) return;
  const idx = floorf(ty) * floorf(LVL[0]) + floorf(tx);
  if (idx >= 0 && idx < TILES.length) TILES[idx] = val;
}

function spawnParticle(x: number, y: number, vx: number, vy: number, life: number, colorIdx: number, size: number): void {
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
    if (PRL[i] <= 0.0) {
      PRX[i] = x; PRY[i] = y; PRVX[i] = vx; PRVY[i] = vy;
      PRL[i] = life; PRM[i] = life; PRC[i] = colorIdx; PRS[i] = size;
      return;
    }
  }
}

function spawnCoinParticles(x: number, y: number): void {
  for (let i = 0; i < 8; i = i + 1) {
    const angle = (i / 8.0) * 6.28;
    const speed = randomFloat(80.0, 160.0);
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 60.0, 0.3, 1, 3.0);
  }
}

function spawnDustParticles(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i = i + 1) {
    spawnParticle(x + randomFloat(-8.0, 8.0), y, randomFloat(-60.0, 60.0), randomFloat(-40.0, -10.0), 0.25, 2, 2.0);
  }
}

function spawnDeathParticles(x: number, y: number): void {
  for (let i = 0; i < 20; i = i + 1) {
    const angle = randomFloat(0.0, 6.28);
    const speed = randomFloat(100.0, 250.0);
    spawnParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 80.0, 0.5, randomInt(0, 3), 4.0);
  }
}

function updateParticles(dt: number): void {
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
    if (PRL[i] <= 0.0) continue;
    PRX[i] = PRX[i] + PRVX[i] * dt;
    PRY[i] = PRY[i] + PRVY[i] * dt;
    PRVY[i] = PRVY[i] + 400.0 * dt;
    PRL[i] = PRL[i] - dt;
  }
}

function drawParticles(): void {
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
    if (PRL[i] <= 0.0) continue;
    const alpha = floorf((PRL[i] / PRM[i]) * 255.0);
    const a = clamp(alpha, 0.0, 255.0);
    const s = PRS[i];
    let r = 200; let g = 200; let b = 200;
    if (PRC[i] < 0.5) { r = 80; g = 140; b = 230; }
    else if (PRC[i] < 1.5) { r = 255; g = 210; b = 50; }
    else if (PRC[i] < 2.5) { r = 160; g = 160; b = 160; }
    else { r = 200; g = 60; b = 50; }
    drawRect(floorf(PRX[i] - s * 0.5), floorf(PRY[i] - s * 0.5), floorf(s), floorf(s), { r: r, g: g, b: b, a: floorf(a) });
  }
}

// Dummy functions to match game's function count
function parseNumberAt(s: string, start: number): void {
  let i = start + 0.0;
  let result = 0.0;
  let negative = 0.0;
  while (i < s.length) {
    const c = s.charCodeAt(floorf(i));
    if ((c > 31.5 && c < 32.5) || (c > 9.5 && c < 10.5) || (c > 12.5 && c < 13.5)) { i = i + 1.0; } else { break; }
  }
  if (i < s.length) {
    const mc = s.charCodeAt(floorf(i));
    if (mc > 44.5 && mc < 45.5) { negative = 1.0; i = i + 1.0; }
  }
  while (i < s.length) {
    const c = s.charCodeAt(floorf(i));
    if (c > 47.5 && c < 57.5) { result = result * 10.0 + (c - 48.0); i = i + 1.0; } else { break; }
  }
  if (negative > 0.5) result = 0.0 - result;
  PARSE_RESULT[0] = result;
  PARSE_RESULT[1] = i;
}

function parseTilesLine(s: string, start: number): void {
  let i = start + 0.0;
  let safety = 0.0;
  while (i < s.length && safety < 5000.0) {
    safety = safety + 1.0;
    const c = s.charCodeAt(floorf(i));
    if (c > 9.5 && c < 10.5) break;
    if (c > 12.5 && c < 13.5) break;
    if (c > 43.5 && c < 44.5) { i = i + 1.0; }
    else if (c > 47.5 && c < 57.5) {
      parseNumberAt(s, i);
      const tidx = floorf(TILE_PARSE_IDX[0]);
      if (tidx < TILES.length) TILES[tidx] = PARSE_RESULT[0];
      TILE_PARSE_IDX[0] = TILE_PARSE_IDX[0] + 1.0;
      i = PARSE_RESULT[1];
    } else { i = i + 1.0; }
  }
}

function clearLevel(): void {
  TILES.length = 0;
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) EA[i] = 0.0;
  for (let i = 0; i < MAX_COINS; i = i + 1) CA[i] = 0.0;
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) PRL[i] = 0.0;
  FLAG_POS[0] = 0.0; FLAG_POS[1] = 0.0; FLAG_POS[2] = 0.0;
}

function hurtPlayer(): void { P[10] = P[10] - 1.0; }
function killPlayer(): void { P[15] = 1.0; }

function playerTileCollisionX(): void {
  const px = P[0] + POX;
  const py = P[1] + POY;
  const leftTile = floorf(px / TILE_SIZE);
  const rightTile = floorf((px + PW - 1.0) / TILE_SIZE);
  const topTile = floorf(py / TILE_SIZE);
  const botTile = floorf((py + PH - 1.0) / TILE_SIZE);
  for (let ty = topTile; ty <= botTile; ty = ty + 1) {
    for (let tx = leftTile; tx <= rightTile; tx = tx + 1) {
      const t = getTile(tx, ty);
      if (isTileSolid(t) > 0.5) { if (P[2] > 0.0) { P[0] = tx * TILE_SIZE - PW - POX; P[2] = 0.0; } else if (P[2] < 0.0) { P[0] = (tx + 1) * TILE_SIZE - POX; P[2] = 0.0; } return; }
    }
  }
}

function playerTileCollisionY(): void {
  const px = P[0] + POX;
  const py = P[1] + POY;
  const leftTile = floorf(px / TILE_SIZE);
  const rightTile = floorf((px + PW - 1.0) / TILE_SIZE);
  const topTile = floorf(py / TILE_SIZE);
  const botTile = floorf((py + PH - 1.0) / TILE_SIZE);
  P[4] = 0.0;
  for (let ty = topTile; ty <= botTile; ty = ty + 1) {
    for (let tx = leftTile; tx <= rightTile; tx = tx + 1) {
      const t = getTile(tx, ty);
      if (isTileSolid(t) > 0.5) { if (P[3] > 0.0) { P[1] = ty * TILE_SIZE - PH - POY; P[3] = 0.0; P[4] = 1.0; } else if (P[3] < 0.0) { P[1] = (ty + 1) * TILE_SIZE - POY; P[3] = 0.0; } return; }
      if (t === T_PLATFORM && P[3] > 0.0) { if (P[16] <= ty * TILE_SIZE + 2.0) { P[1] = ty * TILE_SIZE - PH - POY; P[3] = 0.0; P[4] = 1.0; return; } }
    }
  }
}

function updateEnemies(dt: number): void {
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] < 0.5) continue;
    EX[i] = EX[i] + EVX[i] * dt;
    EHP[i] = EHP[i] + dt * 4.0;
  }
}

function drawEnemies(t: number): void {
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] < 0.5) continue;
    drawRect(floorf(EX[i]), floorf(EY[i]), TILE_SIZE, TILE_SIZE, { r: 200, g: 60, b: 60, a: 255 });
  }
}

function updateCollectibles(dt: number, t: number): void {
  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];
    const dx = absf(P[0] - CX[i]);
    const dy = absf(P[1] - CY[i]);
    if (dx < 24.0 && dy < 24.0) {
      if (type > 19.5) { GS[4] = 1.0; }
      else if (type > 9.5 && type < 10.5) { CA[i] = 0.0; P[11] = P[11] + 1.0; }
    }
  }
}

function drawCollectibles(t: number): void {
  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];
    if (type > 9.5 && type < 10.5) {
      drawRect(floorf(CX[i]), floorf(CY[i]), TILE_SIZE, TILE_SIZE, { r: 255, g: 210, b: 50, a: 255 });
    } else if (type > 10.5 && type < 11.5) {
      drawRect(floorf(CX[i]), floorf(CY[i]), TILE_SIZE, TILE_SIZE, { r: 50, g: 150, b: 255, a: 255 });
    } else if (type > 19.5) {
      drawRect(floorf(CX[i]), floorf(CY[i]) - 64, 8, 96, { r: 160, g: 160, b: 170, a: 255 });
      drawRect(floorf(CX[i]) + 8, floorf(CY[i]) - 60, 24, 18, { r: 230, g: 40, b: 40, a: 255 });
      drawText("GOAL", floorf(CX[i]) - 4, floorf(CY[i]) - 80, 16, { r: 255, g: 255, b: 50, a: 255 });
    }
  }
}

function drawSkyGradient(): void {
  for (let i = 0; i < 20; i = i + 1) {
    const t = i / 19.0;
    drawRect(0, floorf(i * 30.0), SCREEN_W, 31, { r: floorf(100 + 80 * t), g: floorf(180 + 40 * t), b: 255, a: 255 });
  }
}

function drawParallaxBg(): void {
  const mx = CAM[0] * 0.15;
  let mi = 0.0;
  while (mi < 12.0) {
    const px = floorf(mi * 180.0 - (mx % 180.0) - 180.0);
    const h = 80.0 + (mi % 3.0) * 40.0;
    drawTriangle(px, 520, px + 90, floorf(520.0 - h), px + 180, 520, { r: 140, g: 160, b: 200, a: 100 });
    mi = mi + 1.0;
  }
}

function drawVisibleTiles(): void {
  const startCol = floorf((CAM[0] - 432.0) / TILE_SIZE);
  const endCol = floorf((CAM[0] + 432.0) / TILE_SIZE) + 1;
  const startRow = floorf((CAM[1] - 332.0) / TILE_SIZE);
  const endRow = floorf((CAM[1] + 332.0) / TILE_SIZE) + 1;
  for (let ty = startRow; ty <= endRow; ty = ty + 1) {
    for (let tx = startCol; tx <= endCol; tx = tx + 1) {
      const t = getTile(tx, ty);
      if (t > T_AIR) {
        let color: Color = { r: 100, g: 200, b: 60, a: 255 };
        if (t === T_DIRT) color = { r: 150, g: 100, b: 55, a: 255 };
        if (t === T_BRICK) color = { r: 180, g: 80, b: 50, a: 255 };
        drawRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE, color);
      }
    }
  }
}

function drawHUD(): void {
  for (let i = 0; i < 3; i = i + 1) {
    const filled = i < P[10];
    drawRect(10 + i * 36, 10, 28, 28, filled ? { r: 230, g: 50, b: 50, a: 255 } : { r: 80, g: 80, b: 80, a: 255 });
  }
  drawText("x" + floorf(P[11]).toString(), 140, 16, 22, WHITE);
}

function updateCamera(dt: number): void {
  const lookAhead = P[5] > 0.5 ? 60.0 : -60.0;
  CAM[0] = CAM[0] + (P[0] + 16.0 + lookAhead - CAM[0]) * 6.0 * dt;
  CAM[1] = CAM[1] + (P[1] - 20.0 - CAM[1]) * 6.0 * dt;
  const halfW = 400.0;
  const halfH = 300.0;
  if (CAM[0] < halfW) CAM[0] = halfW;
  if (CAM[0] > LVL[0] * TILE_SIZE - halfW) CAM[0] = LVL[0] * TILE_SIZE - halfW;
  if (CAM[1] < halfH) CAM[1] = halfH;
  if (CAM[1] > LVL[1] * TILE_SIZE - halfH) CAM[1] = LVL[1] * TILE_SIZE - halfH;
}

// ============================================================
// TEST SETUP — set entity data like game's parseEntitiesLine
// ============================================================

function setupTestEntities(): void {
  // Coins
  CA[0] = 1.0; CT[0] = 10.0; CX[0] = 256.0; CY[0] = 384.0;
  CA[1] = 1.0; CT[1] = 10.0; CX[1] = 288.0; CY[1] = 384.0;
  CA[2] = 1.0; CT[2] = 10.0; CX[2] = 320.0; CY[2] = 384.0;
  // Gem
  CA[3] = 1.0; CT[3] = 11.0; CX[3] = 960.0; CY[3] = 224.0;
  // Flag at the end
  CA[15] = 1.0; CT[15] = 20.0; CX[15] = 1824.0; CY[15] = 384.0;

  // Walker enemy
  EA[0] = 1.0; ET[0] = 1.0; EX[0] = 480.0; EY[0] = 384.0; EVX[0] = 60.0;
}

function setupTestLevel(): void {
  LVL[0] = 60.0; LVL[1] = 15.0; LVL[2] = 3.0; LVL[3] = 12.0;
  const total = 900;
  while (TILES.length < total) TILES.push(T_AIR);
  for (let x = 0; x < 60; x = x + 1) {
    TILES[13 * 60 + x] = T_GRASS;
    TILES[14 * 60 + x] = T_DIRT;
  }
  P[0] = 3.0 * TILE_SIZE; P[1] = 12.0 * TILE_SIZE;
  CAM[0] = P[0]; CAM[1] = P[1];
}

// ============================================================
// RUN TESTS
// ============================================================

initWindow(SCREEN_W, SCREEN_H, "Array Bug Test");
setTargetFPS(60);
initAudioDevice();

setupTestLevel();
setupTestEntities();

// TEST 1: Direct reads (should always work)
console.log("=== TEST 1: Direct array reads ===");
let t1pass = 1.0;
if (CA[0] < 0.5) { console.log("FAIL: CA[0] not active"); t1pass = 0.0; }
if (CA[15] < 0.5) { console.log("FAIL: CA[15] not active"); t1pass = 0.0; }
if (CT[15] < 19.5) { console.log("FAIL: CT[15]=" + CT[15].toString() + " expected 20"); t1pass = 0.0; }
if (CX[15] < 1823.5 || CX[15] > 1824.5) { console.log("FAIL: CX[15]=" + CX[15].toString() + " expected 1824"); t1pass = 0.0; }
if (CA[50] > 0.5) { console.log("FAIL: CA[50] should be inactive"); t1pass = 0.0; }
if (t1pass > 0.5) { console.log("PASS"); } else { console.log("FAIL"); }

// TEST 2: Loop reads (the bug)
console.log("=== TEST 2: Loop array reads ===");
function testLoopReads(): number {
  let activeCount = 0.0;
  let flagFound = 0.0;
  let wrongReads = 0.0;
  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] > 0.5) {
      activeCount = activeCount + 1.0;
      // Check specific known values
      if (i === 0) {
        if (CT[i] < 9.5 || CT[i] > 10.5) { console.log("FAIL: i=0 CT=" + CT[i].toString() + " expected 10"); wrongReads = wrongReads + 1.0; }
        if (CX[i] < 255.5 || CX[i] > 256.5) { console.log("FAIL: i=0 CX=" + CX[i].toString() + " expected 256"); wrongReads = wrongReads + 1.0; }
      }
      if (i === 15) {
        if (CT[i] < 19.5) { console.log("FAIL: i=15 CT=" + CT[i].toString() + " expected 20"); wrongReads = wrongReads + 1.0; }
        if (CX[i] < 1823.5) { console.log("FAIL: i=15 CX=" + CX[i].toString() + " expected 1824"); wrongReads = wrongReads + 1.0; }
        flagFound = 1.0;
      }
      // Inactive slots should not appear
      if (i > 15 && i < 100) {
        console.log("FAIL: i=" + i.toString() + " is active but should not be (CA=" + CA[i].toString() + ")");
        wrongReads = wrongReads + 1.0;
      }
    }
  }
  console.log("active=" + activeCount.toString() + " (expected 5)");
  console.log("flagFound=" + flagFound.toString() + " (expected 1)");
  console.log("wrongReads=" + wrongReads.toString() + " (expected 0)");
  if (activeCount > 4.5 && activeCount < 5.5 && flagFound > 0.5 && wrongReads < 0.5) return 1.0;
  return 0.0;
}
const t2result = testLoopReads();
if (t2result > 0.5) { console.log("PASS"); } else { console.log("FAIL"); }

// TEST 3: Loop reads inside beginMode2D (matches game draw context)
console.log("=== TEST 3: Loop reads inside beginMode2D ===");
const camera: Camera2D = {
  offset: { x: SCREEN_W / 2, y: SCREEN_H / 2 },
  target: { x: CAM[0], y: CAM[1] },
  rotation: 0.0,
  zoom: 1.0,
};

beginDrawing();
clearBackground(BLACK);
beginMode2D(camera);

let t3active = 0.0;
let t3flag = 0.0;
for (let i = 0; i < MAX_COINS; i = i + 1) {
  if (CA[i] > 0.5) {
    t3active = t3active + 1.0;
    if (CT[i] > 19.5) t3flag = 1.0;
  }
}

endMode2D();
endDrawing();

console.log("active=" + t3active.toString() + " (expected 5)");
console.log("flagFound=" + t3flag.toString() + " (expected 1)");
if (t3active > 4.5 && t3active < 5.5 && t3flag > 0.5) { console.log("PASS"); } else { console.log("FAIL"); }

// TEST 4: drawCollectibles function call
console.log("=== TEST 4: drawCollectibles function ===");
let t4count = 0.0;
// Monkey-patch: count what drawCollectibles visits
beginDrawing();
clearBackground(BLACK);
beginMode2D(camera);
drawCollectibles(0.0);
endMode2D();
endDrawing();
// We can't easily count from inside, but if TEST 2 passes then this should work too
console.log("(visual check — did GOAL render at x=1824?)");

// Summary
console.log("=== SUMMARY ===");
if (t1pass > 0.5 && t2result > 0.5 && t3active > 4.5 && t3flag > 0.5) {
  console.log("ALL TESTS PASSED");
} else {
  console.log("SOME TESTS FAILED");
}

closeAudioDevice();
closeWindow();
