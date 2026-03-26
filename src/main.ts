// ============================================================
// BLOOM JUMP — A Classic 2D Platformer
// Built with Bloom Engine, compiled by Perry
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
// CONSTANTS
// ============================================================

const SCREEN_W = 800;
const SCREEN_H = 600;
const TILE_SRC = 16;   // sprite sheet tile size
const TILE_SIZE = 32;   // display tile size (2x)
const SCALE = 2.0;

// Physics
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

// Player hitbox (smaller than tile for forgiving collisions)
const PW = 20.0;   // player width
const PH = 28.0;   // player height
const POX = 6.0;   // offset x from sprite origin to hitbox
const POY = 4.0;   // offset y

// Tile types (all floats — Perry i32 vs f64 comparison was broken)
const T_AIR = 0.0;
const T_GRASS = 1.0;
const T_DIRT = 2.0;
const T_BRICK = 3.0;
const T_STONE = 4.0;
const T_SPIKE_UP = 5.0;
const T_SPIKE_DN = 6.0;
const T_PLATFORM = 7.0;

// Entity types
const E_WALKER = 1.0;
const E_FLYER = 2.0;
const E_CHASER = 3.0;
const E_COIN = 10.0;
const E_GEM = 11.0;
const E_SPRING = 12.0;
const E_FLAG = 20.0;

// Game states
const ST_MENU = 0.0;
const ST_LEVEL_SELECT = 1.0;
const ST_PLAYING = 2.0;
const ST_PAUSED = 4.0;
const ST_GAME_OVER = 5.0;
const ST_LEVEL_COMPLETE = 6.0;

// Pool sizes
const MAX_ENEMIES = 30;
const MAX_COINS = 100;
const MAX_PARTICLES = 200;

// Colors
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const SKY_TOP: Color = { r: 100, g: 180, b: 255, a: 255 };
const SKY_BOT: Color = { r: 180, g: 220, b: 255, a: 255 };

// ============================================================
// GAME STATE (all const arrays for Perry safety)
// ============================================================

// Player state
// [x, y, vx, vy, grounded, facingRight, coyoteT, jumpBufferT,
//  invincibleT, squashT, health, coins, animFrame, walkTimer,
//  lives, dead, prevBottomY, gems, totalCoins]
const P = [
  0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0,
  0.0, 0.0, 3.0, 0.0, 0.0, 0.0,
  3.0, 0.0, 0.0, 0.0, 0.0,
];
const PI_X = 0; const PI_Y = 1; const PI_VX = 2; const PI_VY = 3;
const PI_GND = 4; const PI_FACE = 5; const PI_COYOTE = 6; const PI_JBUF = 7;
const PI_INV = 8; const PI_SQUASH = 9; const PI_HP = 10; const PI_COINS = 11;
const PI_ANIM = 12; const PI_WALK = 13; const PI_LIVES = 14; const PI_DEAD = 15;
const PI_PBOTY = 16; const PI_GEMS = 17; const PI_TCOINS = 18;

// Camera state [targetX, targetY, zoom]
const CAM = [400.0, 300.0, 1.0];

// Game state [currentState, levelIndex, menuSelection, levelCount, flagReached, completeTimer, deathTimer]
const GS = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const GI_STATE = 0; const GI_LEVEL = 1; const GI_SEL = 2; const GI_LCOUNT = 3;
const GI_FLAG = 4; const GI_CTIMER = 5; const GI_DTIMER = 6;

// Level data
const TILES: number[] = [];
const LVL = [0.0, 0.0, 0.0, 0.0]; // [width, height, spawnX, spawnY]

// Enemy pool (parallel arrays)
const EX: number[] = []; const EY: number[] = []; const EVX: number[] = []; const EVY: number[] = [];
const ET: number[] = []; const EA: number[] = []; const ES: number[] = []; const EHP: number[] = [];

// Coin/collectible pool
const CX: number[] = []; const CY: number[] = []; const CA: number[] = []; const CT: number[] = [];

// Particle pool
const PRX: number[] = []; const PRY: number[] = []; const PRVX: number[] = []; const PRVY: number[] = [];
const PRL: number[] = []; const PRM: number[] = []; const PRC: number[] = []; const PRS: number[] = [];

// Level file list (up to 20)
const LEVEL_NAMES: string[] = [];
const LEVEL_FILES: string[] = [];

// ============================================================
// INITIALIZATION
// ============================================================

initWindow(SCREEN_W, SCREEN_H, "Bloom Jump");
setTargetFPS(60);
initAudioDevice();

// Load textures — stage in parallel on background threads, then commit on main thread
const TEX_PATHS = [
  "assets/sprites/tileset.png",
  "assets/sprites/player.png",
  "assets/sprites/enemies.png",
  "assets/sprites/items.png",
  "assets/sprites/ui.png",
  "assets/sprites/bg_mountains.png",
  "assets/sprites/bg_hills.png",
  "assets/sprites/bg_clouds.png",
];

// Show loading screen
beginDrawing();
clearBackground({ r: 30, g: 30, b: 40, a: 255 });
drawText("Loading...", SCREEN_W / 2 - 60, SCREEN_H / 2 - 10, 24, { r: 200, g: 200, b: 220, a: 255 });
endDrawing();

// Stage all textures on background threads (parallel decode)
const staged = stageTextures(TEX_PATHS);

// Commit to GPU on main thread
const texTileset = commitTexture(staged[0]);
setTextureFilter(texTileset, FILTER_NEAREST);
const texPlayer = commitTexture(staged[1]);
setTextureFilter(texPlayer, FILTER_NEAREST);
const texEnemies = commitTexture(staged[2]);
setTextureFilter(texEnemies, FILTER_NEAREST);
const texItems = commitTexture(staged[3]);
setTextureFilter(texItems, FILTER_NEAREST);
const texUI = commitTexture(staged[4]);
setTextureFilter(texUI, FILTER_NEAREST);
const texBgMount = commitTexture(staged[5]);
const texBgHills = commitTexture(staged[6]);
const texBgClouds = commitTexture(staged[7]);

// Load sounds
const sndJump = loadSound("assets/sounds/jump.wav");
const sndCoin = loadSound("assets/sounds/coin.wav");
const sndStomp = loadSound("assets/sounds/stomp.wav");
const sndHurt = loadSound("assets/sounds/hurt.wav");
const sndSpring = loadSound("assets/sounds/spring.wav");
const sndDeath = loadSound("assets/sounds/death.wav");
const sndGem = loadSound("assets/sounds/gem.wav");
const sndComplete = loadSound("assets/sounds/complete.wav");
const sndSelect = loadSound("assets/sounds/select.wav");

// Initialize pools
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
// HELPER FUNCTIONS
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

// ============================================================
// SPRITE DRAWING
// ============================================================

function drawSpriteFromSheet(tex: Texture, frameX: number, frameY: number, srcW: number, srcH: number, dstX: number, dstY: number, dstW: number, dstH: number, tint: Color): void {
  drawTexturePro(
    tex,
    { x: frameX, y: frameY, width: srcW, height: srcH },
    { x: dstX, y: dstY, width: dstW, height: dstH },
    { x: 0.0, y: 0.0 }, 0.0, tint,
  );
}

function drawTileAt(tileType: number, sx: number, sy: number): void {
  if (tileType <= T_AIR) return;
  const col = (tileType - 1) % 8;
  const row = floorf((tileType - 1) / 8);
  drawSpriteFromSheet(texTileset, col * TILE_SRC, row * TILE_SRC, TILE_SRC, TILE_SRC, sx, sy, TILE_SIZE, TILE_SIZE, WHITE);
}

function drawPlayerSprite(x: number, y: number, frame: number, facingRight: number): void {
  const srcW = facingRight > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  drawTexturePro(
    texPlayer,
    { x: frame * TILE_SRC, y: 0.0, width: srcW, height: TILE_SRC },
    { x: x, y: y, width: TILE_SIZE, height: TILE_SIZE },
    { x: 0.0, y: 0.0 }, 0.0, WHITE,
  );
}

function drawEnemySprite(type: number, frame: number, x: number, y: number, facingRight: number): void {
  let row = 0;
  if (type === E_FLYER) row = 1;
  if (type === E_CHASER) row = 2;
  const srcW = facingRight > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  drawTexturePro(
    texEnemies,
    { x: frame * TILE_SRC, y: row * TILE_SRC, width: srcW, height: TILE_SRC },
    { x: x, y: y, width: TILE_SIZE, height: TILE_SIZE },
    { x: 0.0, y: 0.0 }, 0.0, WHITE,
  );
}

function drawItemSprite(frame: number, x: number, y: number): void {
  drawSpriteFromSheet(texItems, frame * TILE_SRC, 0, TILE_SRC, TILE_SRC, x, y, TILE_SIZE, TILE_SIZE, WHITE);
}

// ============================================================
// PARTICLE SYSTEM
// ============================================================

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
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 60.0;
    spawnParticle(x, y, vx, vy, 0.3, 1, 3.0); // 1 = gold color
  }
}

function spawnDustParticles(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i = i + 1) {
    const vx = randomFloat(-60.0, 60.0);
    const vy = randomFloat(-40.0, -10.0);
    spawnParticle(x + randomFloat(-8.0, 8.0), y, vx, vy, 0.25, 2, 2.0); // 2 = gray
  }
}

function spawnDeathParticles(x: number, y: number): void {
  for (let i = 0; i < 20; i = i + 1) {
    const angle = randomFloat(0.0, 6.28);
    const speed = randomFloat(100.0, 250.0);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 80.0;
    const c = randomInt(0, 3);
    spawnParticle(x, y, vx, vy, 0.5, c, 4.0);
  }
}

function updateParticles(dt: number): void {
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
    if (PRL[i] <= 0.0) continue;
    PRX[i] = PRX[i] + PRVX[i] * dt;
    PRY[i] = PRY[i] + PRVY[i] * dt;
    PRVY[i] = PRVY[i] + 400.0 * dt; // particle gravity
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
    if (PRC[i] < 0.5) { r = 80; g = 140; b = 230; }       // blue (player)
    else if (PRC[i] < 1.5) { r = 255; g = 210; b = 50; }   // gold (coin)
    else if (PRC[i] < 2.5) { r = 160; g = 160; b = 160; }  // gray (dust)
    else { r = 200; g = 60; b = 50; }                       // red (enemy)
    drawRect(floorf(PRX[i] - s * 0.5), floorf(PRY[i] - s * 0.5), floorf(s), floorf(s), { r: r, g: g, b: b, a: floorf(a) });
  }
}

// ============================================================
// LEVEL LOADING
// ============================================================

function clearLevel(): void {
  TILES.length = 0;
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) EA[i] = 0.0;
  for (let i = 0; i < MAX_COINS; i = i + 1) CA[i] = 0.0;
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) PRL[i] = 0.0;
}

// Parse numbers directly from string at offset, returns [value, nextIndex]
// Uses charCodeAt to avoid string comparisons (Perry-safe)
const PARSE_RESULT = [0.0, 0.0]; // [value, nextIndex]

// All char comparisons inlined — Perry can't reliably return booleans from functions

function parseNumberAt(s: string, start: number): void {
  let i = start + 0.0;
  let result = 0.0;
  let negative = 0.0;

  // Skip whitespace (32=space, 13=CR, 10=LF)
  while (i < s.length) {
    const c = s.charCodeAt(floorf(i));
    if ((c > 31.5 && c < 32.5) || (c > 9.5 && c < 10.5) || (c > 12.5 && c < 13.5)) { i = i + 1.0; } else { break; }
  }
  // Check for minus (45)
  if (i < s.length) {
    const mc = s.charCodeAt(floorf(i));
    if (mc > 44.5 && mc < 45.5) { negative = 1.0; i = i + 1.0; }
  }
  // Read digits (48-57)
  while (i < s.length) {
    const c = s.charCodeAt(floorf(i));
    if (c > 47.5 && c < 57.5) {
      result = result * 10.0 + (c - 48.0);
      i = i + 1.0;
    } else {
      break;
    }
  }

  if (negative > 0.5) result = 0.0 - result;
  PARSE_RESULT[0] = result;
  PARSE_RESULT[1] = i;
}

// Parse comma-separated numbers into TILES using index assignment (not push — Perry bug)
// TILE_PARSE_IDX[0] tracks the write index into TILES
const TILE_PARSE_IDX = [0.0];

function parseTilesLine(s: string, start: number): void {
  let i = start + 0.0;
  let safety = 0.0;
  while (i < s.length && safety < 5000.0) {
    safety = safety + 1.0;
    const c = s.charCodeAt(floorf(i));
    if (c > 9.5 && c < 10.5) break;  // LF
    if (c > 12.5 && c < 13.5) break; // CR
    if (c > 43.5 && c < 44.5) {      // comma
      i = i + 1.0;
    } else if (c > 47.5 && c < 57.5) { // digit
      parseNumberAt(s, i);
      const tidx = floorf(TILE_PARSE_IDX[0]);
      if (tidx < TILES.length) {
        TILES[tidx] = PARSE_RESULT[0];
      }
      TILE_PARSE_IDX[0] = TILE_PARSE_IDX[0] + 1.0;
      i = PARSE_RESULT[1];
    } else {
      i = i + 1.0;
    }
  }
}

// Parse entity records: "type,x,y;type,x,y;..."
function parseEntitiesLine(s: string, start: number): void {
  let i = start + 0.0;
  let enemyIdx = 0.0;
  let coinIdx = 0.0;
  for (let ei = 0; ei < MAX_ENEMIES; ei = ei + 1) { if (EA[ei] > 0.5) enemyIdx = ei + 1.0; }
  for (let ci = 0; ci < MAX_COINS; ci = ci + 1) { if (CA[ci] > 0.5) coinIdx = ci + 1.0; }

  let safety = 0.0;
  while (i < s.length && safety < 1000.0) {
    safety = safety + 1.0;
    const c = s.charCodeAt(floorf(i));
    // newline = done
    if ((c > 9.5 && c < 10.5) || (c > 12.5 && c < 13.5)) break;
    // semicolon (59) = skip
    if (c > 58.5 && c < 59.5) { i = i + 1.0; }
    // digit or minus = parse triple
    else if ((c > 47.5 && c < 57.5) || (c > 44.5 && c < 45.5)) {
      parseNumberAt(s, i);
      const eType = PARSE_RESULT[0];
      i = PARSE_RESULT[1];
      // skip comma
      if (i < s.length) { const cc = s.charCodeAt(floorf(i)); if (cc > 43.5 && cc < 44.5) i = i + 1.0; }

      parseNumberAt(s, i);
      const ex = PARSE_RESULT[0];
      i = PARSE_RESULT[1];
      if (i < s.length) { const cc = s.charCodeAt(floorf(i)); if (cc > 43.5 && cc < 44.5) i = i + 1.0; }

      parseNumberAt(s, i);
      const ey = PARSE_RESULT[0];
      i = PARSE_RESULT[1];

      if (eType > 0.5 && eType < 9.5) {
        if (enemyIdx < MAX_ENEMIES) {
          EX[floorf(enemyIdx)] = ex * TILE_SIZE;
          EY[floorf(enemyIdx)] = ey * TILE_SIZE;
          ET[floorf(enemyIdx)] = eType;
          EA[floorf(enemyIdx)] = 1.0;
          ES[floorf(enemyIdx)] = 1.0;
          EHP[floorf(enemyIdx)] = 1.0;
          if (eType < 1.5) { EVX[floorf(enemyIdx)] = 60.0; EVY[floorf(enemyIdx)] = 0.0; }
          else if (eType < 2.5) { EVX[floorf(enemyIdx)] = 40.0; EVY[floorf(enemyIdx)] = 0.0; }
          else { EVX[floorf(enemyIdx)] = 0.0; EVY[floorf(enemyIdx)] = 0.0; }
          enemyIdx = enemyIdx + 1.0;
        }
      } else if (eType > 9.5) {
        if (coinIdx < MAX_COINS) {
          CX[floorf(coinIdx)] = ex * TILE_SIZE;
          CY[floorf(coinIdx)] = ey * TILE_SIZE;
          CT[floorf(coinIdx)] = eType;
          CA[floorf(coinIdx)] = 1.0;
          coinIdx = coinIdx + 1.0;
        }
      }
    } else {
      i = i + 1.0;
    }
  }
}

function loadLevelFromString(data: string): void {
  clearLevel();

  // Scan for line boundaries and colon positions in one flat pass
  const LINE_STARTS: number[] = [];
  const COLON_POS: number[] = [];
  const LINE_ENDS: number[] = [];

  let idx = 0.0;
  const dlen = data.length;
  let lineStart = 0.0;
  let colonFound = 99999.0;
  while (idx < dlen) {
    const c = data.charCodeAt(floorf(idx));
    if (c > 57.5 && c < 58.5) {
      if (colonFound > 99998.0) colonFound = idx;
    }
    if (c > 9.5 && c < 10.5) {
      LINE_STARTS.push(lineStart);
      if (colonFound > 99998.0) { COLON_POS.push(-1.0); } else { COLON_POS.push(colonFound); }
      LINE_ENDS.push(idx);
      lineStart = idx + 1.0;
      colonFound = 99999.0;
    }
    idx = idx + 1.0;
  }
  if (lineStart < dlen) {
    LINE_STARTS.push(lineStart);
    if (colonFound > 99998.0) { COLON_POS.push(-1.0); } else { COLON_POS.push(colonFound); }
    LINE_ENDS.push(dlen);
  }

  // Pass 1: Parse width and height first (need them to pre-allocate TILES)
  let li = 0.0;
  while (li < LINE_STARTS.length) {
    const ls = LINE_STARTS[floorf(li)];
    const cp = COLON_POS[floorf(li)];
    li = li + 1.0;
    if (cp < 0.0) { /* no colon */ } else {
      const k0 = data.charCodeAt(floorf(ls));
      const valStart = floorf(cp) + 1.0;
      if (k0 > 118.5 && k0 < 119.5) { parseNumberAt(data, valStart); LVL[0] = PARSE_RESULT[0]; }
      if (k0 > 103.5 && k0 < 104.5) { parseNumberAt(data, valStart); LVL[1] = PARSE_RESULT[0]; }
      if (k0 > 114.5 && k0 < 115.5) {
        parseNumberAt(data, valStart);
        LVL[2] = PARSE_RESULT[0];
        let si = PARSE_RESULT[1];
        if (si < dlen) { const sc = data.charCodeAt(floorf(si)); if (sc > 43.5 && sc < 44.5) si = si + 1.0; }
        parseNumberAt(data, si);
        LVL[3] = PARSE_RESULT[0];
      }
    }
  }

  // Pre-allocate TILES with zeros (use index assignment, NOT push from nested functions)
  const totalTiles = floorf(LVL[0]) * floorf(LVL[1]);
  // Grow TILES to needed size at module level
  while (TILES.length < totalTiles) TILES.push(T_AIR);
  // Zero out all tiles
  let zi = 0.0;
  while (zi < totalTiles) { TILES[floorf(zi)] = T_AIR; zi = zi + 1.0; }

  // Pass 2: Parse tiles and entities (using index assignment for tiles)
  TILE_PARSE_IDX[0] = 0.0;
  li = 0.0;
  while (li < LINE_STARTS.length) {
    const ls = LINE_STARTS[floorf(li)];
    const cp = COLON_POS[floorf(li)];
    li = li + 1.0;
    if (cp < 0.0) { /* no colon */ } else {
      const k0 = data.charCodeAt(floorf(ls));
      const valStart = floorf(cp) + 1.0;
      if (k0 > 115.5 && k0 < 116.5) { parseTilesLine(data, valStart); }
      if (k0 > 100.5 && k0 < 101.5) { parseEntitiesLine(data, valStart); }
    }
  }
}


function loadLevel(index: number): void {
  if (index < 0 || index >= LEVEL_FILES.length) return;
  const path = LEVEL_FILES[floorf(index)];
  if (fileExists(path)) {
    const data = readFile(path);
    loadLevelFromString(data);
  }
}

function resetPlayer(): void {
  P[PI_X] = LVL[2] * TILE_SIZE;
  P[PI_Y] = LVL[3] * TILE_SIZE;
  P[PI_VX] = 0.0; P[PI_VY] = 0.0;
  P[PI_GND] = 0.0; P[PI_FACE] = 1.0;
  P[PI_COYOTE] = 0.0; P[PI_JBUF] = 0.0;
  P[PI_INV] = 0.0; P[PI_SQUASH] = 0.0;
  P[PI_DEAD] = 0.0;
  P[PI_ANIM] = 0.0; P[PI_WALK] = 0.0;
  P[PI_PBOTY] = P[PI_Y] + PH;
  GS[GI_FLAG] = 0.0;
  GS[GI_CTIMER] = 0.0;
  GS[GI_DTIMER] = 0.0;
}

function startLevel(index: number): void {
  GS[GI_LEVEL] = index;
  loadLevel(index);
  P[PI_HP] = 3.0;
  P[PI_COINS] = 0.0;
  P[PI_GEMS] = 0.0;
  P[PI_TCOINS] = 0.0;
  resetPlayer();
  // Center camera on player immediately
  CAM[0] = P[PI_X];
  CAM[1] = P[PI_Y];
}

// Discover level files
function discoverLevels(): void {
  LEVEL_NAMES.length = 0;
  LEVEL_FILES.length = 0;
  // Check built-in levels
  for (let i = 1; i <= 10; i = i + 1) {
    const path = "levels/level" + i.toString() + ".txt";
    if (fileExists(path)) {
      LEVEL_FILES.push(path);
      LEVEL_NAMES.push("Level " + i.toString());
    }
  }
  // Check custom levels
  for (let i = 1; i <= 20; i = i + 1) {
    const path = "levels/custom_" + i.toString() + ".txt";
    if (fileExists(path)) {
      LEVEL_FILES.push(path);
      LEVEL_NAMES.push("Custom " + i.toString());
    }
  }
  GS[GI_LCOUNT] = LEVEL_FILES.length;
}

// ============================================================
// PLAYER PHYSICS & COLLISION
// ============================================================

function playerTileCollisionX(): void {
  const px = P[PI_X] + POX;
  const py = P[PI_Y] + POY;

  const leftTile = floorf(px / TILE_SIZE);
  const rightTile = floorf((px + PW - 1.0) / TILE_SIZE);
  const topTile = floorf(py / TILE_SIZE);
  const botTile = floorf((py + PH - 1.0) / TILE_SIZE);

  for (let ty = topTile; ty <= botTile; ty = ty + 1) {
    for (let tx = leftTile; tx <= rightTile; tx = tx + 1) {
      const t = getTile(tx, ty);
      if (isTileSolid(t) > 0.5) {
        const tileLeft = tx * TILE_SIZE;
        const tileRight = tileLeft + TILE_SIZE;
        // Push out
        if (P[PI_VX] > 0.0) {
          P[PI_X] = tileLeft - PW - POX;
          P[PI_VX] = 0.0;
        } else if (P[PI_VX] < 0.0) {
          P[PI_X] = tileRight - POX;
          P[PI_VX] = 0.0;
        }
        return;
      }
      if (isTileHazard(t) > 0.5) {
        hurtPlayer();
      }
    }
  }
}

function playerTileCollisionY(): void {
  const px = P[PI_X] + POX;
  const py = P[PI_Y] + POY;

  const leftTile = floorf(px / TILE_SIZE);
  const rightTile = floorf((px + PW - 1.0) / TILE_SIZE);
  const topTile = floorf(py / TILE_SIZE);
  const botTile = floorf((py + PH - 1.0) / TILE_SIZE);

  P[PI_GND] = 0.0;

  for (let ty = topTile; ty <= botTile; ty = ty + 1) {
    for (let tx = leftTile; tx <= rightTile; tx = tx + 1) {
      const t = getTile(tx, ty);
      const tileTop = ty * TILE_SIZE;
      const tileBot = tileTop + TILE_SIZE;

      if (isTileSolid(t) > 0.5) {
        if (P[PI_VY] > 0.0) {
          // Landing on top
          P[PI_Y] = tileTop - PH - POY;
          P[PI_VY] = 0.0;
          P[PI_GND] = 1.0;
          P[PI_COYOTE] = COYOTE_TIME;
          if (P[PI_SQUASH] < 0.01 && P[PI_SQUASH] > -0.01) {
            P[PI_SQUASH] = 0.15; // landing squash
            spawnDustParticles(P[PI_X] + TILE_SIZE * 0.5, P[PI_Y] + TILE_SIZE - 2.0, 4);
          }
        } else if (P[PI_VY] < 0.0) {
          // Bumping head
          P[PI_Y] = tileBot - POY;
          P[PI_VY] = 0.0;
        }
        return;
      }

      // One-way platform
      if (t === T_PLATFORM && P[PI_VY] > 0.0) {
        // Only collide if player was above platform last frame
        if (P[PI_PBOTY] <= tileTop + 2.0) {
          P[PI_Y] = tileTop - PH - POY;
          P[PI_VY] = 0.0;
          P[PI_GND] = 1.0;
          P[PI_COYOTE] = COYOTE_TIME;
          return;
        }
      }

      if (isTileHazard(t) > 0.5) {
        hurtPlayer();
      }
    }
  }
}

function hurtPlayer(): void {
  if (P[PI_INV] > 0.0 || P[PI_DEAD] > 0.5) return;
  P[PI_HP] = P[PI_HP] - 1.0;
  P[PI_INV] = INVINCIBLE_TIME;
  P[PI_VY] = -200.0;
  playSound(sndHurt);
  if (P[PI_HP] <= 0.0) {
    killPlayer();
  }
}

function killPlayer(): void {
  P[PI_DEAD] = 1.0;
  P[PI_VY] = -300.0;
  GS[GI_DTIMER] = 2.0;
  spawnDeathParticles(P[PI_X] + TILE_SIZE * 0.5, P[PI_Y] + TILE_SIZE * 0.5);
  playSound(sndDeath);
}

function updatePlayer(dt: number): void {
  if (P[PI_DEAD] > 0.5) {
    // Dead: just fall and wait
    P[PI_VY] = P[PI_VY] + GRAVITY * dt;
    P[PI_Y] = P[PI_Y] + P[PI_VY] * dt;
    GS[GI_DTIMER] = GS[GI_DTIMER] - dt;
    if (GS[GI_DTIMER] <= 0.0) {
      P[PI_LIVES] = P[PI_LIVES] - 1.0;
      if (P[PI_LIVES] <= 0.0) {
        GS[GI_STATE] = ST_GAME_OVER;
      } else {
        P[PI_HP] = 3.0;
        P[PI_DEAD] = 0.0;
        resetPlayer();
      }
    }
    return;
  }

  // Level complete check
  if (GS[GI_FLAG] > 0.5) {
    GS[GI_CTIMER] = GS[GI_CTIMER] - dt;
    if (GS[GI_CTIMER] <= 0.0) {
      GS[GI_STATE] = ST_LEVEL_COMPLETE;
    }
    return;
  }

  // --- Input ---
  let moveDir = 0.0;
  if (isKeyDown(Key.LEFT) || isKeyDown(Key.A)) moveDir = moveDir - 1.0;
  if (isKeyDown(Key.RIGHT) || isKeyDown(Key.D)) moveDir = moveDir + 1.0;

  // Facing
  if (moveDir > 0.5) P[PI_FACE] = 1.0;
  if (moveDir < -0.5) P[PI_FACE] = 0.0;

  // Jump buffer
  if (isKeyPressed(Key.SPACE) || isKeyPressed(Key.UP) || isKeyPressed(Key.W)) {
    P[PI_JBUF] = JUMP_BUFFER;
  }

  // --- Horizontal movement ---
  const accel = P[PI_GND] > 0.5 ? ACCEL_GROUND : ACCEL_AIR;
  const friction = P[PI_GND] > 0.5 ? FRICTION_GROUND : FRICTION_AIR;

  if (absf(moveDir) > 0.1) {
    P[PI_VX] = P[PI_VX] + moveDir * accel * dt;
    if (P[PI_VX] > MOVE_SPEED) P[PI_VX] = MOVE_SPEED;
    if (P[PI_VX] < 0.0 - MOVE_SPEED) P[PI_VX] = 0.0 - MOVE_SPEED;
  } else {
    // Apply friction
    if (P[PI_VX] > 0.0) {
      P[PI_VX] = P[PI_VX] - friction * dt;
      if (P[PI_VX] < 0.0) P[PI_VX] = 0.0;
    } else if (P[PI_VX] < 0.0) {
      P[PI_VX] = P[PI_VX] + friction * dt;
      if (P[PI_VX] > 0.0) P[PI_VX] = 0.0;
    }
  }

  // --- Jump ---
  const canJump = P[PI_COYOTE] > 0.0;
  if (P[PI_JBUF] > 0.0 && canJump) {
    P[PI_VY] = JUMP_VEL;
    P[PI_GND] = 0.0;
    P[PI_COYOTE] = 0.0;
    P[PI_JBUF] = 0.0;
    P[PI_SQUASH] = -0.15; // jump stretch
    spawnDustParticles(P[PI_X] + TILE_SIZE * 0.5, P[PI_Y] + TILE_SIZE, 3);
    playSound(sndJump);
  }

  // Variable jump height (cut jump short on release)
  if (P[PI_VY] < 0.0 && !isKeyDown(Key.SPACE) && !isKeyDown(Key.UP) && !isKeyDown(Key.W)) {
    P[PI_VY] = P[PI_VY] * 0.9; // dampen upward velocity
  }

  // --- Gravity with apex hang ---
  let grav = GRAVITY;
  if (absf(P[PI_VY]) < APEX_THRESHOLD && P[PI_GND] < 0.5) {
    grav = GRAVITY * APEX_MULT;
  }
  P[PI_VY] = P[PI_VY] + grav * dt;
  if (P[PI_VY] > MAX_FALL) P[PI_VY] = MAX_FALL;

  // --- Timers ---
  if (P[PI_COYOTE] > 0.0) P[PI_COYOTE] = P[PI_COYOTE] - dt;
  if (P[PI_JBUF] > 0.0) P[PI_JBUF] = P[PI_JBUF] - dt;
  if (P[PI_INV] > 0.0) P[PI_INV] = P[PI_INV] - dt;
  if (P[PI_SQUASH] > 0.0) P[PI_SQUASH] = P[PI_SQUASH] - dt * 4.0;
  if (P[PI_SQUASH] < 0.0) P[PI_SQUASH] = P[PI_SQUASH] + dt * 4.0;

  // Remember previous bottom Y for platform collision
  P[PI_PBOTY] = P[PI_Y] + POY + PH;

  // --- Apply movement and collide ---
  // Horizontal
  P[PI_X] = P[PI_X] + P[PI_VX] * dt;
  playerTileCollisionX();

  // Vertical
  P[PI_Y] = P[PI_Y] + P[PI_VY] * dt;
  playerTileCollisionY();

  // Fall off bottom of level = death
  if (P[PI_Y] > LVL[1] * TILE_SIZE + 100.0) {
    killPlayer();
  }

  // --- Animation ---
  if (P[PI_GND] > 0.5) {
    if (absf(P[PI_VX]) > 10.0) {
      P[PI_WALK] = P[PI_WALK] + dt * absf(P[PI_VX]) * 0.015;
      const walkPhase = floorf(P[PI_WALK]) % 4;
      P[PI_ANIM] = 2.0 + walkPhase; // run frames 2-5
    } else {
      P[PI_ANIM] = 0.0; // idle
    }
  } else {
    if (P[PI_VY] < 0.0) P[PI_ANIM] = 6.0; // jump
    else P[PI_ANIM] = 7.0; // fall
  }
}

// ============================================================
// ENEMIES
// ============================================================

function updateEnemies(dt: number): void {
  const playerCX = P[PI_X] + TILE_SIZE * 0.5;
  const playerCY = P[PI_Y] + TILE_SIZE * 0.5;

  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] < 0.5) continue;

    const type = ET[i];

    if (type < 1.5) {
      // Walker: patrol left/right
      EX[i] = EX[i] + EVX[i] * dt;
      // Check wall ahead
      const frontX = EVX[i] > 0.0 ? EX[i] + TILE_SIZE : EX[i] - 1.0;
      const tileAhead = getTile(floorf(frontX / TILE_SIZE), floorf((EY[i] + TILE_SIZE * 0.5) / TILE_SIZE));
      // Check floor ahead
      const floorX = EVX[i] > 0.0 ? EX[i] + TILE_SIZE : EX[i];
      const tileBelow = getTile(floorf(floorX / TILE_SIZE), floorf((EY[i] + TILE_SIZE + 2.0) / TILE_SIZE));

      if (isTileSolid(tileAhead) > 0.5 || (isTileSolid(tileBelow) < 0.5 && tileBelow !== T_PLATFORM)) {
        EVX[i] = 0.0 - EVX[i];
        ES[i] = EVX[i] > 0.0 ? 1.0 : 0.0;
      }
      // Animation
      EHP[i] = EHP[i] + dt * 4.0;
    } else if (type < 2.5) {
      // Flyer: sine wave
      EX[i] = EX[i] + EVX[i] * dt;
      ES[i] = ES[i] + dt * 3.0;
      EVY[i] = Math.sin(ES[i]) * 60.0;
      EY[i] = EY[i] + EVY[i] * dt;

      // Reverse at edges
      const frontX = EVX[i] > 0.0 ? EX[i] + TILE_SIZE + 4.0 : EX[i] - 4.0;
      const tileAhead = getTile(floorf(frontX / TILE_SIZE), floorf((EY[i] + TILE_SIZE * 0.5) / TILE_SIZE));
      if (isTileSolid(tileAhead) > 0.5) {
        EVX[i] = 0.0 - EVX[i];
      }
      EHP[i] = EHP[i] + dt * 6.0;
    } else {
      // Chaser: pursue when close
      const dx = playerCX - (EX[i] + TILE_SIZE * 0.5);
      const dy = playerCY - (EY[i] + TILE_SIZE * 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 200.0 && P[PI_DEAD] < 0.5) {
        const chaseSpeed = 120.0;
        if (dx > 0.0) { EVX[i] = chaseSpeed; ES[i] = 1.0; }
        else { EVX[i] = 0.0 - chaseSpeed; ES[i] = 0.0; }
      } else if (dist > 400.0) {
        EVX[i] = 0.0;
      }
      EX[i] = EX[i] + EVX[i] * dt;
      // Wall collision
      const frontX = EVX[i] > 0.0 ? EX[i] + TILE_SIZE : EX[i] - 1.0;
      const tileAhead = getTile(floorf(frontX / TILE_SIZE), floorf((EY[i] + TILE_SIZE * 0.5) / TILE_SIZE));
      if (isTileSolid(tileAhead) > 0.5) {
        EVX[i] = 0.0;
      }
      EHP[i] = EHP[i] + dt * 4.0;
    }

    // Player collision with enemy
    if (P[PI_DEAD] > 0.5 || P[PI_INV] > 0.0) continue;

    const playerRect: Rect = { x: P[PI_X] + POX, y: P[PI_Y] + POY, width: PW, height: PH };
    const enemyRect: Rect = { x: EX[i] + 4.0, y: EY[i] + 4.0, width: TILE_SIZE - 8.0, height: TILE_SIZE - 8.0 };

    if (checkCollisionRecs(playerRect, enemyRect)) {
      // Check if stomping (player falling and above enemy)
      if (P[PI_VY] > 0.0 && P[PI_PBOTY] < EY[i] + 12.0 && type < 2.5) {
        // Stomp! (flyers can't be stomped: type === E_FLYER check)
        if (type < 1.5 || type > 2.5) {
          // Walker or Chaser - can be stomped
          EA[i] = 0.0;
          P[PI_VY] = STOMP_BOUNCE;
          spawnDustParticles(EX[i] + TILE_SIZE * 0.5, EY[i] + TILE_SIZE, 6);
          playSound(sndStomp);
        } else {
          // Flyer - can't stomp, take damage
          hurtPlayer();
        }
      } else {
        // Side/bottom collision - take damage
        hurtPlayer();
      }
    }
  }
}

function drawEnemies(t: number): void {
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] < 0.5) continue;
    const frame = floorf(EHP[i]) % 2;
    const facingR = ES[i] > 0.5 ? 1.0 : 0.0;
    drawEnemySprite(floorf(ET[i]), frame, floorf(EX[i]), floorf(EY[i]), facingR);
  }
}

// ============================================================
// COLLECTIBLES
// ============================================================

function updateCollectibles(dt: number, t: number): void {
  if (P[PI_DEAD] > 0.5 || GS[GI_FLAG] > 0.5) return;

  const playerRect: Rect = { x: P[PI_X] + POX, y: P[PI_Y] + POY, width: PW, height: PH };

  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];

    const itemRect: Rect = { x: CX[i] + 6.0, y: CY[i] + 6.0, width: 20.0, height: 20.0 };

    if (checkCollisionRecs(playerRect, itemRect)) {
      if (type > 9.5 && type < 10.5) {
        // Coin
        CA[i] = 0.0;
        P[PI_COINS] = P[PI_COINS] + 1.0;
        P[PI_TCOINS] = P[PI_TCOINS] + 1.0;
        spawnCoinParticles(CX[i] + TILE_SIZE * 0.5, CY[i] + TILE_SIZE * 0.5);
        playSound(sndCoin);
        // Extra life at 100 coins
        if (P[PI_TCOINS] >= 100.0) {
          P[PI_TCOINS] = P[PI_TCOINS] - 100.0;
          P[PI_LIVES] = P[PI_LIVES] + 1.0;
        }
      } else if (type > 10.5 && type < 11.5) {
        // Gem
        CA[i] = 0.0;
        P[PI_GEMS] = P[PI_GEMS] + 1.0;
        spawnCoinParticles(CX[i] + TILE_SIZE * 0.5, CY[i] + TILE_SIZE * 0.5);
        playSound(sndGem);
      } else if (type > 11.5 && type < 12.5) {
        // Spring
        P[PI_VY] = SPRING_VEL;
        P[PI_GND] = 0.0;
        P[PI_SQUASH] = -0.2;
        playSound(sndSpring);
      } else if (type > 19.5) {
        // Flag - level complete!
        GS[GI_FLAG] = 1.0;
        GS[GI_CTIMER] = 2.0;
        playSound(sndComplete);
      }
    }
  }
}

function drawCollectibles(t: number): void {
  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];

    if (type > 9.5 && type < 10.5) {
      // Coin (spinning animation)
      const frame = floorf(t * 6.0) % 4;
      drawItemSprite(frame, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 10.5 && type < 11.5) {
      // Gem
      drawItemSprite(4, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 11.5 && type < 12.5) {
      // Spring
      drawItemSprite(5, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 19.5) {
      // Flag
      const frame = floorf(t * 3.0) % 2;
      drawItemSprite(7 + frame, floorf(CX[i]), floorf(CY[i]));
    }
  }
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera(dt: number): void {
  const lookAhead = P[PI_FACE] > 0.5 ? 60.0 : -60.0;
  const targetX = P[PI_X] + TILE_SIZE * 0.5 + lookAhead;
  const targetY = P[PI_Y] - 20.0;

  CAM[0] = CAM[0] + (targetX - CAM[0]) * 6.0 * dt;
  CAM[1] = CAM[1] + (targetY - CAM[1]) * 6.0 * dt;

  // Clamp to level bounds
  const halfW = SCREEN_W * 0.5 / CAM[2];
  const halfH = SCREEN_H * 0.5 / CAM[2];
  const levelW = LVL[0] * TILE_SIZE;
  const levelH = LVL[1] * TILE_SIZE;

  if (CAM[0] < halfW) CAM[0] = halfW;
  if (CAM[0] > levelW - halfW) CAM[0] = levelW - halfW;
  if (CAM[1] < halfH) CAM[1] = halfH;
  if (CAM[1] > levelH - halfH) CAM[1] = levelH - halfH;
}

// ============================================================
// DRAWING
// ============================================================

function drawSkyGradient(): void {
  const steps = 20;
  const stripH = SCREEN_H / steps;
  for (let i = 0; i < steps; i = i + 1) {
    const t = i / (steps - 1.0);
    const r = floorf(SKY_TOP.r + (SKY_BOT.r - SKY_TOP.r) * t);
    const g = floorf(SKY_TOP.g + (SKY_BOT.g - SKY_TOP.g) * t);
    const b = floorf(SKY_TOP.b + (SKY_BOT.b - SKY_TOP.b) * t);
    drawRect(0, floorf(i * stripH), SCREEN_W, floorf(stripH) + 1, { r: r, g: g, b: b, a: 255 });
  }
}

function drawParallaxBg(): void {
  // Mountains (far layer, 0.2x scroll)
  const mountScrollX = CAM[0] * 0.2;
  const mountY = SCREEN_H - 200;
  const mountW = 800;
  // Tile horizontally
  const mountStart = floorf(mountScrollX / mountW) * mountW;
  for (let x = mountStart - mountW; x < mountStart + SCREEN_W + mountW; x = x + mountW) {
    drawTexturePro(texBgMount,
      { x: 0, y: 0, width: 800, height: 200 },
      { x: floorf(x - mountScrollX), y: mountY, width: 800, height: 200 },
      { x: 0, y: 0 }, 0.0, WHITE);
  }

  // Hills (near layer, 0.4x scroll)
  const hillScrollX = CAM[0] * 0.4;
  const hillY = SCREEN_H - 150;
  const hillW = 800;
  const hillStart = floorf(hillScrollX / hillW) * hillW;
  for (let x = hillStart - hillW; x < hillStart + SCREEN_W + hillW; x = x + hillW) {
    drawTexturePro(texBgHills,
      { x: 0, y: 0, width: 800, height: 150 },
      { x: floorf(x - hillScrollX), y: hillY, width: 800, height: 150 },
      { x: 0, y: 0 }, 0.0, WHITE);
  }
}

function drawVisibleTiles(): void {
  const camX = CAM[0];
  const camY = CAM[1];
  const halfW = SCREEN_W * 0.5 / CAM[2] + TILE_SIZE;
  const halfH = SCREEN_H * 0.5 / CAM[2] + TILE_SIZE;

  const startCol = floorf((camX - halfW) / TILE_SIZE);
  const endCol = floorf((camX + halfW) / TILE_SIZE) + 1;
  const startRow = floorf((camY - halfH) / TILE_SIZE);
  const endRow = floorf((camY + halfH) / TILE_SIZE) + 1;

  for (let ty = startRow; ty <= endRow; ty = ty + 1) {
    for (let tx = startCol; tx <= endCol; tx = tx + 1) {
      const t = getTile(tx, ty);
      if (t > T_AIR) {
        drawTileAt(t, tx * TILE_SIZE, ty * TILE_SIZE);
      }
    }
  }
}

function drawPlayerCharacter(t: number): void {
  if (P[PI_DEAD] > 0.5) return;

  // Invincibility blink
  if (P[PI_INV] > 0.0) {
    const blinkPhase = floorf(P[PI_INV] * 10.0) % 2;
    if (blinkPhase > 0) return;
  }

  const frame = floorf(P[PI_ANIM]);
  let drawY = P[PI_Y];
  let drawH = TILE_SIZE;

  // Squash/stretch
  if (P[PI_SQUASH] > 0.01) {
    const sq = P[PI_SQUASH] * 3.0;
    drawH = floorf(TILE_SIZE * (1.0 - sq * 0.3));
    drawY = P[PI_Y] + (TILE_SIZE - drawH);
  } else if (P[PI_SQUASH] < -0.01) {
    const st = absf(P[PI_SQUASH]) * 3.0;
    drawH = floorf(TILE_SIZE * (1.0 + st * 0.2));
    drawY = P[PI_Y] - floorf(st * 3.0);
  }

  const srcW = P[PI_FACE] > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  drawTexturePro(
    texPlayer,
    { x: frame * TILE_SRC, y: 0.0, width: srcW, height: TILE_SRC },
    { x: floorf(P[PI_X]), y: floorf(drawY), width: TILE_SIZE, height: floorf(drawH) },
    { x: 0.0, y: 0.0 }, 0.0, WHITE,
  );
}

function drawHUD(): void {
  // Hearts
  for (let i = 0; i < 3; i = i + 1) {
    const hx = 10 + i * 36;
    const hy = 10;
    if (i < P[PI_HP]) {
      drawSpriteFromSheet(texUI, 0, 0, 16, 16, hx, hy, 32, 32, WHITE);
    } else {
      drawSpriteFromSheet(texUI, 16, 0, 16, 16, hx, hy, 32, 32, WHITE);
    }
  }

  // Coin count
  drawSpriteFromSheet(texUI, 32, 0, 16, 16, 130, 14, 24, 24, WHITE);
  drawText("x" + floorf(P[PI_COINS]).toString(), 158, 16, 22, WHITE);

  // Gem count
  if (P[PI_GEMS] > 0.0) {
    drawItemSprite(4, 220, 10);
    drawText("x" + floorf(P[PI_GEMS]).toString(), 254, 16, 22, WHITE);
  }

  // Lives
  drawText("Lives: " + floorf(P[PI_LIVES]).toString(), SCREEN_W - 120, 16, 20, WHITE);
}

// ============================================================
// MENU SCREENS
// ============================================================

function drawTitleScreen(t: number): void {
  drawSkyGradient();
  drawParallaxBg();

  // Title
  const titleText = "BLOOM JUMP";
  const titleW = measureText(titleText, 60);
  drawText(titleText, floorf((SCREEN_W - titleW) / 2), 120, 60, WHITE);

  // Subtitle
  const subText = "A Bloom Engine Platformer";
  const subW = measureText(subText, 20);
  drawText(subText, floorf((SCREEN_W - subW) / 2), 190, 20, { r: 220, g: 220, b: 255, a: 255 });

  // Menu options
  const options = ["Play Game", "Level Editor (run ./editor)"];
  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < 2; i = i + 1) {
    const label = options[i];
    const oy = 300 + i * 50;
    const ow = measureText(label, 30);
    const ox = floorf((SCREEN_W - ow) / 2);
    if (i === selIdx) {
      // Selected indicator
      const pulse = Math.sin(t * 4.0) * 0.3 + 0.7;
      const alpha = floorf(255.0 * pulse);
      drawText("> " + label + " <", ox - 30, oy, 30, { r: 255, g: 255, b: 100, a: alpha });
    } else {
      drawText(label, ox, oy, 30, { r: 200, g: 200, b: 220, a: 200 });
    }
  }

  // Instructions
  drawText("Arrow Keys / WASD to move, SPACE to jump", floorf(SCREEN_W / 2) - 220, SCREEN_H - 60, 16, { r: 180, g: 180, b: 200, a: 180 });
}

function updateTitleScreen(): void {
  if (isKeyPressed(Key.DOWN) || isKeyPressed(Key.S)) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] > 1.0) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.UP) || isKeyPressed(Key.W)) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = 1.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.ENTER) || isKeyPressed(Key.SPACE)) {
    const sel = floorf(GS[GI_SEL]);
    if (sel === 0) {
      discoverLevels();
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = 0.0;
      playSound(sndSelect);
    }
    // sel === 1: editor is a separate binary, no action
  }
}

function drawLevelSelect(t: number): void {
  drawSkyGradient();

  drawText("SELECT LEVEL", floorf(SCREEN_W / 2) - 120, 40, 36, WHITE);

  const count = floorf(GS[GI_LCOUNT]);
  if (count < 1) {
    drawText("No levels found in levels/ directory", 150, 250, 20, { r: 200, g: 200, b: 200, a: 200 });
    drawText("Run the editor to create levels!", 170, 290, 20, { r: 200, g: 200, b: 200, a: 200 });
  }

  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < count; i = i + 1) {
    if (i >= LEVEL_NAMES.length) break;
    const name = LEVEL_NAMES[i];
    const oy = 100 + i * 40;
    if (oy > SCREEN_H - 80) break;

    if (i === selIdx) {
      drawRect(80, oy - 4, SCREEN_W - 160, 36, { r: 255, g: 255, b: 255, a: 30 });
      drawText("> " + name, 100, oy, 24, { r: 255, g: 255, b: 100, a: 255 });
    } else {
      drawText(name, 120, oy, 24, { r: 200, g: 200, b: 220, a: 200 });
    }
  }

  drawText("ENTER to play, ESC to go back", floorf(SCREEN_W / 2) - 160, SCREEN_H - 40, 18, { r: 180, g: 180, b: 200, a: 180 });
}

function updateLevelSelect(): void {
  const count = floorf(GS[GI_LCOUNT]);
  if (isKeyPressed(Key.DOWN) || isKeyPressed(Key.S)) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] >= count) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.UP) || isKeyPressed(Key.W)) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = count - 1.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.ENTER) || isKeyPressed(Key.SPACE)) {
    if (count > 0) {
      startLevel(floorf(GS[GI_SEL]));
      GS[GI_STATE] = ST_PLAYING;
      playSound(sndSelect);
    }
  }
  if (isKeyPressed(Key.ESCAPE)) {
    GS[GI_STATE] = ST_MENU;
    GS[GI_SEL] = 0.0;
  }
}

function drawPauseScreen(): void {
  drawRect(0, 0, SCREEN_W, SCREEN_H, { r: 0, g: 0, b: 0, a: 150 });
  const text = "PAUSED";
  const tw = measureText(text, 48);
  drawText(text, floorf((SCREEN_W - tw) / 2), 220, 48, WHITE);
  drawText("Press ESC to resume", floorf(SCREEN_W / 2) - 100, 290, 20, { r: 200, g: 200, b: 220, a: 200 });
  drawText("Press Q to quit to menu", floorf(SCREEN_W / 2) - 120, 330, 20, { r: 200, g: 200, b: 220, a: 200 });
}

function drawGameOver(): void {
  drawSkyGradient();
  const text = "GAME OVER";
  const tw = measureText(text, 48);
  drawText(text, floorf((SCREEN_W - tw) / 2), 200, 48, { r: 230, g: 60, b: 60, a: 255 });

  const coinsText = "Coins: " + floorf(P[PI_COINS]).toString();
  const cw = measureText(coinsText, 24);
  drawText(coinsText, floorf((SCREEN_W - cw) / 2), 280, 24, WHITE);

  drawText("Press ENTER to continue", floorf(SCREEN_W / 2) - 120, 360, 20, { r: 200, g: 200, b: 220, a: 200 });
}

function drawLevelCompleteScreen(t: number): void {
  drawRect(0, 0, SCREEN_W, SCREEN_H, { r: 0, g: 0, b: 0, a: 150 });
  const text = "LEVEL COMPLETE!";
  const tw = measureText(text, 42);
  drawText(text, floorf((SCREEN_W - tw) / 2), 180, 42, { r: 255, g: 255, b: 100, a: 255 });

  const coinsText = "Coins: " + floorf(P[PI_COINS]).toString();
  const cw = measureText(coinsText, 24);
  drawText(coinsText, floorf((SCREEN_W - cw) / 2), 260, 24, WHITE);

  if (P[PI_GEMS] > 0.0) {
    const gemText = "Gems: " + floorf(P[PI_GEMS]).toString();
    const gw = measureText(gemText, 24);
    drawText(gemText, floorf((SCREEN_W - gw) / 2), 300, 24, { r: 50, g: 150, b: 255, a: 255 });
  }

  drawText("Press ENTER to continue", floorf(SCREEN_W / 2) - 120, 380, 20, { r: 200, g: 200, b: 220, a: 200 });
}

// ============================================================
// MAIN GAME LOOP
// ============================================================

const camera: Camera2D = {
  offset: { x: SCREEN_W / 2, y: SCREEN_H / 2 },
  target: { x: 0.0, y: 0.0 },
  rotation: 0.0,
  zoom: 1.0,
};

// Start at title screen
GS[GI_STATE] = ST_MENU;

while (!windowShouldClose()) {
  const dt = getDeltaTime();
  const t = getTime();

  beginDrawing();

  const state = floorf(GS[GI_STATE]);

  if (state === ST_MENU) {
    // === TITLE SCREEN ===
    updateTitleScreen();
    drawTitleScreen(t);

  } else if (state === ST_LEVEL_SELECT) {
    // === LEVEL SELECT ===
    updateLevelSelect();
    drawLevelSelect(t);

  } else if (state === ST_PLAYING) {
    // === GAMEPLAY ===
    updatePlayer(dt);
    updateEnemies(dt);
    updateCollectibles(dt, t);
    updateParticles(dt);
    updateCamera(dt);

    // Update camera struct
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    camera.zoom = CAM[2];

    // Draw
    drawSkyGradient();
    drawParallaxBg();

    beginMode2D(camera);
    drawVisibleTiles();
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    drawParticles();
    endMode2D();

    drawHUD();

    // Level complete overlay
    if (GS[GI_FLAG] > 0.5 && GS[GI_CTIMER] <= 0.0) {
      // Handled by state change
    }

    // Pause
    if (isKeyPressed(Key.ESCAPE)) {
      GS[GI_STATE] = ST_PAUSED;
    }

  } else if (state === ST_PAUSED) {
    // === PAUSED ===
    // Draw game underneath
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    drawSkyGradient();
    drawParallaxBg();
    beginMode2D(camera);
    drawVisibleTiles();
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD();
    drawPauseScreen();

    if (isKeyPressed(Key.ESCAPE)) {
      GS[GI_STATE] = ST_PLAYING;
    }
    if (isKeyPressed(Key.Q)) {
      GS[GI_STATE] = ST_MENU;
      GS[GI_SEL] = 0.0;
    }

  } else if (state === ST_GAME_OVER) {
    // === GAME OVER ===
    drawGameOver();
    if (isKeyPressed(Key.ENTER)) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL];
      P[PI_LIVES] = 3.0;
    }

  } else if (state === ST_LEVEL_COMPLETE) {
    // === LEVEL COMPLETE ===
    // Draw game underneath
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    drawSkyGradient();
    drawParallaxBg();
    beginMode2D(camera);
    drawVisibleTiles();
    drawCollectibles(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD();
    drawLevelCompleteScreen(t);

    if (isKeyPressed(Key.ENTER)) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL] + 1.0;
      if (GS[GI_SEL] >= GS[GI_LCOUNT]) GS[GI_SEL] = 0.0;
    }
  }

  endDrawing();
}

closeAudioDevice();
closeWindow();
