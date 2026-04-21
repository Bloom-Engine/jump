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
  isMobile, isTV, isWatch, getPlatform, getCrownRotation,
  getTouchX, getTouchY, getTouchCount,
  isGamepadAvailable, getGamepadAxis, isGamepadButtonPressed, isGamepadButtonDown,
} from "bloom/core";
import { Color, Key, Camera2D, MouseButton } from "bloom/core";
import {
  drawRect, drawCircle, drawTriangle, drawLine, drawRectLines,
  checkCollisionRecs,
} from "bloom/shapes";
import { drawTextRgba, measureText } from "bloom/text";
import {
  loadTexture, drawTexturePro, drawTextureRec,
  setTextureFilter, FILTER_NEAREST,
} from "bloom/textures";
import {
  initAudioDevice, closeAudioDevice,
  loadSound, playSound, setSoundVolume,
  loadMusicRaw, playMusicRaw, stopMusicRaw, updateMusicStreamRaw, setMusicVolumeRaw,
} from "bloom/audio";
import { clamp, randomFloat, randomInt, lerp } from "bloom/math";
import { Rect, Texture, Sound } from "bloom/core";

// Direct FFI declaration — bypasses TypeScript wrapper object creation/property access overhead.
// Each drawTexturePro via the wrapper creates 4 objects + 16 property lookups.
// Direct call: zero objects, zero lookups, single FFI call.
declare function bloom_draw_texture_pro(
  handle: number, sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
  ox: number, oy: number, rot: number,
  r: number, g: number, b: number, a: number
): void;
declare function bloom_draw_rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_rect_lines(x: number, y: number, w: number, h: number, thickness: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_circle(cx: number, cy: number, radius: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_line(x1: number, y1: number, x2: number, y2: number, thickness: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_text(text: number, x: number, y: number, size: number, r: number, g: number, b: number, a: number): void;

// ============================================================
// PLATFORM DETECTION
// ============================================================

// Platform detection — Perry-safe numeric checks
// Platform: 0=unknown, 1=macos, 2=ios, 3=windows, 4=linux, 5=android, 6=tvos, 7=web, 8=watchos
const PLATF = [0.0, 0.0, 0.0, 0.0]; // [platform, isMobile, isTV, isWatch]
PLATF[0] = getPlatform();
if (PLATF[0] > 1.5 && PLATF[0] < 2.5) PLATF[1] = 1.0;  // iOS
if (PLATF[0] > 4.5 && PLATF[0] < 5.5) PLATF[1] = 1.0;  // Android
if (PLATF[0] > 5.5 && PLATF[0] < 6.5) PLATF[2] = 1.0;  // tvOS
if (PLATF[0] > 7.5 && PLATF[0] < 8.5) PLATF[3] = 1.0;  // watchOS
const MOBILE = PLATF[1];
const TV = PLATF[2];
const WATCH = PLATF[3];

// Crown accumulator — smooths Digital Crown rotation into a [-1,1] horizontal
// axis value used by the player-movement code. Crown deltas are radians since
// last read; we scale, decay, and clamp.
const CROWN = [0.0]; // [velocity ∈ [-1,1]]
const CROWN_SCALE = 6.0;  // radians/sec → axis sensitivity
const CROWN_DECAY = 0.80; // per-frame velocity decay when crown is still

// ============================================================
// TOUCH / GAMEPAD INPUT STATE (Perry-safe const arrays)
// ============================================================

// Touch state: [joyActive, joyX, joyY, jumpDown, jumpPressed, pausePressed, prevJump]
const TCH = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const TI_JOY_ACTIVE = 0;
const TI_JOY_X = 1;
const TI_JOY_Y = 2;
const TI_JUMP_DOWN = 3;
const TI_JUMP_PRESSED = 4;
const TI_PAUSE_PRESSED = 5;
const TI_PREV_JUMP = 6;

// Touch control layout
const TOUCH_JOY_RADIUS = 70.0;
const TOUCH_JOY_X_POS = 180.0;
const TOUCH_JOY_Y_OFFSET = 200.0;
const TOUCH_JUMP_RADIUS = 60.0;
const TOUCH_JUMP_X_OFFSET = 160.0;
const TOUCH_JUMP_Y_OFFSET = 180.0;
const TOUCH_PAUSE_SIZE = 44.0;
const TOUCH_PAUSE_X_OFFSET = 60.0;
const TOUCH_PAUSE_Y_OFFSET = 60.0;

// Gamepad state: [moveX, jump, pause, up, down, confirm]
const GP = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const GP_MOVE_X = 0;
const GP_JUMP = 1;
const GP_PAUSE = 2;
const GP_UP = 3;
const GP_DOWN = 4;
const GP_CONFIRM = 5;
const GP_DEADZONE = 0.15;

// ============================================================
// CONSTANTS
// ============================================================

const SCREEN_W = 800;
const SCREEN_H = 600;
const DESIGN_H = 600.0; // UI reference height for scaling

// Atlas sub-sheet offsets (where each sprite sheet lives in the 256x256 atlas)
const ATLAS_TILE_X = 0.0;
const ATLAS_TILE_Y = 0.0;
const ATLAS_ENEMY_X = 128.0;
const ATLAS_ENEMY_Y = 0.0;
const ATLAS_PLAYER_X = 0.0;
const ATLAS_PLAYER_Y = 64.0;
const ATLAS_ITEM_X = 0.0;
const ATLAS_ITEM_Y = 80.0;
const ATLAS_UI_X = 0.0;
const ATLAS_UI_Y = 96.0;

// UI scale state [uiScale] — updated each frame from screen size
const UI = [1.0];
const UI_SCALE = 0;

// DEBUG counters: [tcSeen, outerLoop, xPassed, hitMatched]
const DBG = [0.0, 0.0, 0.0, 0.0];
const TILE_SRC = 16;   // sprite sheet tile size
const TILE_SIZE = 32;   // display tile size (2x)
const SCALE = 2.0;

// Physics
const GRAVITY = 1200.0;
const JUMP_VEL = -520.0;
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
const SPRING_VEL = -680.0;

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
const ST_CREDITS = 7.0;

// Pool sizes
const MAX_ENEMIES = 30;
const MAX_COINS = 100;
const MAX_PARTICLES = 200;

// Colors
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const SKY_TOP: Color = { r: 100, g: 180, b: 255, a: 255 };
const SKY_BOT: Color = { r: 180, g: 220, b: 255, a: 255 };
const MOUNT_COLOR: Color = { r: 140, g: 160, b: 200, a: 100 };
const HILL_COLOR: Color = { r: 80, g: 150, b: 80, a: 80 };
const FLAG_GLOW: Color = { r: 50, g: 255, b: 50, a: 60 };
const FLAG_POLE: Color = { r: 160, g: 160, b: 170, a: 255 };
const FLAG_BANNER: Color = { r: 230, g: 40, b: 40, a: 255 };
const FLAG_BANNER2: Color = { r: 210, g: 30, b: 30, a: 255 };
const FLAG_BALL: Color = { r: 255, g: 220, b: 50, a: 255 };
const FLAG_TEXT: Color = { r: 255, g: 255, b: 50, a: 255 };
const LOADING_BG: Color = { r: 30, g: 30, b: 40, a: 255 };
const LOADING_TEXT: Color = { r: 200, g: 200, b: 220, a: 255 };
const MENU_DIM: Color = { r: 200, g: 200, b: 220, a: 200 };
const SKY_STRIP: Color = { r: 0, g: 0, b: 0, a: 255 }; // reused per sky gradient strip

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
// Separate debug counter array (Perry may not respect out-of-bounds appends)
const GSDBG = [0.0, 0.0, 0.0, 0.0];
const DBG_FRAME = 0;
const DBG_TOUCH = 1;
const DBG_LOOP = 2;
const DBG_HIT = 3;
const DBG_PROOF = [0.0];
const GI_STATE = 0; const GI_LEVEL = 1; const GI_SEL = 2; const GI_LCOUNT = 3;
const GI_FLAG = 4; const GI_CTIMER = 5; const GI_DTIMER = 6;

// Level data
const TILES: number[] = [];
const LVL = [0.0, 0.0, 0.0, 0.0]; // [width, height, spawnX, spawnY]
const FLAG_POS = [0.0, 0.0, 0.0]; // [x_pixels, y_pixels, active]

// Pre-allocated rects for collision checks (avoid per-frame allocation)
const PRECT: Rect = { x: 0.0, y: 0.0, width: PW, height: PH };
const ERECT: Rect = { x: 0.0, y: 0.0, width: 0.0, height: 0.0 };

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

initWindow(SCREEN_W, SCREEN_H, "Bloom Jump", false);
setTargetFPS(60);
initAudioDevice();


// Show loading screen
beginDrawing();
clearBackground(LOADING_BG);
drawTextRgba("Loading...", getScreenWidth() / 2 - 60, getScreenHeight() / 2 - 10, 24, 200, 200, 220, 255);
endDrawing();

// Load single atlas texture (all sprites in one sheet = zero texture switches)
const texAtlas = loadTexture("assets/sprites/atlas.png");
setTextureFilter(texAtlas, FILTER_NEAREST);
// Cache texture ID to avoid repeated string-based property lookup on texAtlas.id
const ATLAS_ID = texAtlas.id;
const UI_TEX_ID = ATLAS_ID; // same atlas

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

// Load music — raw number handles bypass Perry aarch64 NaN-box bug
// where `music.handle` field reads corrupt FFI f64 args (same issue as Color fields)
const musMenu = loadMusicRaw("assets/sounds/music_menu.wav");
const musGame = loadMusicRaw("assets/sounds/music_game.wav");
setMusicVolumeRaw(musMenu, 0.5);
setMusicVolumeRaw(musGame, 0.5);

// Music state: [currentTrack] — 0=none, 1=menu, 2=game
const MUS = [0.0];

function switchMusic(track: number): void {
  if (MUS[0] > 0.5 && MUS[0] < 1.5) stopMusicRaw(musMenu);
  if (MUS[0] > 1.5 && MUS[0] < 2.5) stopMusicRaw(musGame);
  MUS[0] = track;
  if (track > 0.5 && track < 1.5) playMusicRaw(musMenu);
  if (track > 1.5 && track < 2.5) playMusicRaw(musGame);
}

// Credits scroll state: [scrollY]
const CRED = [0.0];

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
// TOUCH / GAMEPAD INPUT PROCESSING
// ============================================================

function updateTouchInput(sw: number, sh: number): void {
  // Save previous jump state for edge detection
  TCH[TI_PREV_JUMP] = TCH[TI_JUMP_DOWN];

  // Reset per-frame values
  TCH[TI_JOY_ACTIVE] = 0.0;
  TCH[TI_JOY_X] = 0.0;
  TCH[TI_JOY_Y] = 0.0;
  TCH[TI_JUMP_DOWN] = 0.0;
  TCH[TI_JUMP_PRESSED] = 0.0;
  TCH[TI_PAUSE_PRESSED] = 0.0;

  // watchOS: Digital Crown drives horizontal movement, any touch = jump.
  if (WATCH > 0.5) {
    const crownDelta = getCrownRotation();
    // Accumulate crown velocity with decay so continuous rotation builds up
    // to full axis deflection and stopping drops it back to zero smoothly.
    let v = CROWN[0] * CROWN_DECAY + crownDelta * CROWN_SCALE;
    if (v > 1.0) v = 1.0;
    if (v < -1.0) v = -1.0;
    CROWN[0] = v;
    TCH[TI_JOY_X] = v;
    TCH[TI_JOY_ACTIVE] = 1.0;
    if (getTouchCount() > 0.5) {
      TCH[TI_JUMP_DOWN] = 1.0;
    }
    if (TCH[TI_JUMP_DOWN] > 0.5 && TCH[TI_PREV_JUMP] < 0.5) {
      TCH[TI_JUMP_PRESSED] = 1.0;
    }
    return;
  }

  if (MOBILE < 0.5) return;

  const s = UI[UI_SCALE];
  const tc = getTouchCount();
  const joyBaseX = TOUCH_JOY_X_POS * s;
  const joyBaseY = sh - TOUCH_JOY_Y_OFFSET * s;
  const jumpBaseX = sw - TOUCH_JUMP_X_OFFSET * s;
  const jumpBaseY = sh - TOUCH_JUMP_Y_OFFSET * s;
  const pauseBaseX = sw - TOUCH_PAUSE_X_OFFSET * s;
  const pauseBaseY = TOUCH_PAUSE_Y_OFFSET * s;
  const joyRadiusScaled = TOUCH_JOY_RADIUS * s;
  const jumpRadiusScaled = TOUCH_JUMP_RADIUS * s;
  const pauseSizeScaled = TOUCH_PAUSE_SIZE * s;

  for (let ti = 0.0; ti < tc; ti = ti + 1.0) {
    const tx = getTouchX(ti);
    const ty = getTouchY(ti);

    // Left side of screen = joystick zone
    if (tx < sw * 0.4) {
      const dx = tx - joyBaseX;
      const dy = ty - joyBaseY;
      const distSq = dx * dx + dy * dy;
      if (distSq > 25.0) {
        let adx = dx; if (adx < 0.0) adx = 0.0 - adx;
        let ady = dy; if (ady < 0.0) ady = 0.0 - ady;
        let dist = adx;
        if (ady > adx) { dist = ady + adx * 0.4; }
        else { dist = adx + ady * 0.4; }
        if (dist < 1.0) dist = 1.0;
        let clampDist = dist;
        if (clampDist > joyRadiusScaled) clampDist = joyRadiusScaled;
        TCH[TI_JOY_X] = (dx / dist) * (clampDist / joyRadiusScaled);
        TCH[TI_JOY_Y] = (dy / dist) * (clampDist / joyRadiusScaled);
        TCH[TI_JOY_ACTIVE] = 1.0;
      }
    }

    // Right bottom = jump button zone
    const jdx = tx - jumpBaseX;
    const jdy = ty - jumpBaseY;
    if (jdx * jdx + jdy * jdy < jumpRadiusScaled * jumpRadiusScaled) {
      TCH[TI_JUMP_DOWN] = 1.0;
    }

    // Top-right = pause button zone
    const pdx = tx - pauseBaseX;
    const pdy = ty - pauseBaseY;
    if (pdx * pdx + pdy * pdy < pauseSizeScaled * pauseSizeScaled) {
      TCH[TI_PAUSE_PRESSED] = 1.0;
    }
  }

  // Edge detection: jump pressed this frame (rising edge)
  if (TCH[TI_JUMP_DOWN] > 0.5 && TCH[TI_PREV_JUMP] < 0.5) {
    TCH[TI_JUMP_PRESSED] = 1.0;
  }
}

function updateGamepadInput(): void {
  GP[GP_MOVE_X] = 0.0;
  GP[GP_JUMP] = 0.0;
  GP[GP_PAUSE] = 0.0;
  GP[GP_UP] = 0.0;
  GP[GP_DOWN] = 0.0;
  GP[GP_CONFIRM] = 0.0;

  if (!isGamepadAvailable()) return;

  // Left stick / d-pad horizontal
  const lx = getGamepadAxis(0);
  if (lx > GP_DEADZONE) GP[GP_MOVE_X] = 1.0;
  if (lx < 0.0 - GP_DEADZONE) GP[GP_MOVE_X] = 0.0 - 1.0;

  // Left stick / d-pad vertical (for menus)
  const ly = getGamepadAxis(1);
  if (ly < 0.0 - GP_DEADZONE) GP[GP_UP] = 1.0;
  if (ly > GP_DEADZONE) GP[GP_DOWN] = 1.0;

  // Button A (index 0) = jump / confirm
  if (isGamepadButtonPressed(0)) {
    GP[GP_JUMP] = 1.0;
    GP[GP_CONFIRM] = 1.0;
  }

  // Menu button (index 7)
  if (isGamepadButtonPressed(7)) {
    GP[GP_PAUSE] = 1.0;
  }
}

// ============================================================
// SPRITE DRAWING
// ============================================================

// Direct FFI sprite drawing — avoids object allocation + property lookup overhead
function drawSpriteFromSheet(tex: Texture, frameX: number, frameY: number, srcW: number, srcH: number, dstX: number, dstY: number, dstW: number, dstH: number, tint: Color): void {
  bloom_draw_texture_pro(tex.id, frameX, frameY, srcW, srcH, dstX, dstY, dstW, dstH, 0.0, 0.0, 0.0, tint.r, tint.g, tint.b, tint.a);
}

function drawTileAt(tileType: number, sx: number, sy: number): void {
  if (tileType <= T_AIR) return;
  const col = (tileType - 1) % 8;
  const row = floorf((tileType - 1) / 8);
  bloom_draw_texture_pro(ATLAS_ID, ATLAS_TILE_X + col * TILE_SRC, ATLAS_TILE_Y + row * TILE_SRC, TILE_SRC, TILE_SRC, sx, sy, TILE_SIZE, TILE_SIZE, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
}

function drawPlayerSprite(x: number, y: number, frame: number, facingRight: number): void {
  const baseX = ATLAS_PLAYER_X + frame * TILE_SRC;
  const srcX = facingRight > 0.5 ? baseX : baseX + TILE_SRC;
  const srcW = facingRight > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  bloom_draw_texture_pro(ATLAS_ID, srcX, ATLAS_PLAYER_Y, srcW, TILE_SRC, x, y, TILE_SIZE, TILE_SIZE, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
}

function drawEnemySprite(type: number, frame: number, x: number, y: number, facingRight: number): void {
  let row = 0;
  if (type === E_FLYER) row = 1;
  if (type === E_CHASER) row = 2;
  const baseX = ATLAS_ENEMY_X + frame * TILE_SRC;
  const srcX = facingRight > 0.5 ? baseX : baseX + TILE_SRC;
  const srcW = facingRight > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  bloom_draw_texture_pro(ATLAS_ID, srcX, ATLAS_ENEMY_Y + row * TILE_SRC, srcW, TILE_SRC, x, y, TILE_SIZE, TILE_SIZE, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
}

function drawItemSprite(frame: number, x: number, y: number): void {
  bloom_draw_texture_pro(ATLAS_ID, ATLAS_ITEM_X + frame * TILE_SRC, ATLAS_ITEM_Y, TILE_SRC, TILE_SRC, x, y, TILE_SIZE, TILE_SIZE, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
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
    if (PRC[i] < 0.5) { r = 80; g = 140; b = 230; }       // blue (player)
    else if (PRC[i] < 1.5) { r = 255; g = 210; b = 50; }   // gold (coin)
    else if (PRC[i] < 2.5) { r = 160; g = 160; b = 160; }  // gray (dust)
    else { r = 200; g = 60; b = 50; }                       // red (enemy)
    bloom_draw_rect(floorf(PRX[i] - s * 0.5), floorf(PRY[i] - s * 0.5), floorf(s), floorf(s), r, g, b, floorf(a));
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
  FLAG_POS[0] = 0.0; FLAG_POS[1] = 0.0; FLAG_POS[2] = 0.0;
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
      } else if (eType > 19.5) {
        // Flag — store in dedicated array for reliable access
        FLAG_POS[0] = ex * TILE_SIZE;
        FLAG_POS[1] = ey * TILE_SIZE;
        FLAG_POS[2] = 1.0;
        // Also store as collectible for collision detection
        if (coinIdx < MAX_COINS) {
          CX[floorf(coinIdx)] = ex * TILE_SIZE;
          CY[floorf(coinIdx)] = ey * TILE_SIZE;
          CT[floorf(coinIdx)] = eType;
          CA[floorf(coinIdx)] = 1.0;
          coinIdx = coinIdx + 1.0;
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

// Discover level files (use readFile length check since fileExists has issues on Windows)
function discoverLevels(): void {
  LEVEL_NAMES.length = 0;
  LEVEL_FILES.length = 0;
  // Check built-in levels
  for (let i = 1; i <= 10; i = i + 1) {
    const path = "assets/levels/level" + i.toString() + ".txt";
    const data = readFile(path);
    if (data.length > 0) {
      LEVEL_FILES.push(path);
      LEVEL_NAMES.push("Level " + i.toString());
    }
  }
  // Check custom levels
  for (let i = 1; i <= 20; i = i + 1) {
    const path = "assets/levels/custom_" + i.toString() + ".txt";
    const data = readFile(path);
    if (data.length > 0) {
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
  // Keyboard
  if (isKeyDown(Key.LEFT) || isKeyDown(Key.A)) moveDir = moveDir - 1.0;
  if (isKeyDown(Key.RIGHT) || isKeyDown(Key.D)) moveDir = moveDir + 1.0;
  // Touch joystick
  if (TCH[TI_JOY_X] < -0.3) moveDir = moveDir - 1.0;
  if (TCH[TI_JOY_X] > 0.3) moveDir = moveDir + 1.0;
  // Gamepad
  if (GP[GP_MOVE_X] > 0.5) moveDir = moveDir + 1.0;
  if (GP[GP_MOVE_X] < -0.5) moveDir = moveDir - 1.0;
  // Clamp
  if (moveDir > 1.0) moveDir = 1.0;
  if (moveDir < -1.0) moveDir = -1.0;

  // Facing
  if (moveDir > 0.5) P[PI_FACE] = 1.0;
  if (moveDir < -0.5) P[PI_FACE] = 0.0;

  // Jump buffer
  if (isKeyPressed(Key.SPACE) || isKeyPressed(Key.UP) || isKeyPressed(Key.W)) {
    P[PI_JBUF] = JUMP_BUFFER;
  }
  if (TCH[TI_JUMP_PRESSED] > 0.5) P[PI_JBUF] = JUMP_BUFFER;
  if (GP[GP_JUMP] > 0.5) P[PI_JBUF] = JUMP_BUFFER;

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
  let jumpHeld = 0.0;
  if (isKeyDown(Key.SPACE) || isKeyDown(Key.UP) || isKeyDown(Key.W)) jumpHeld = 1.0;
  if (TCH[TI_JUMP_DOWN] > 0.5) jumpHeld = 1.0;
  if (isGamepadAvailable()) { if (isGamepadButtonDown(0)) jumpHeld = 1.0; }
  if (P[PI_VY] < 0.0 && jumpHeld < 0.5) {
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
      const distSq = dx * dx + dy * dy;
      if (distSq < 40000.0 && P[PI_DEAD] < 0.5) {
        const chaseSpeed = 120.0;
        if (dx > 0.0) { EVX[i] = chaseSpeed; ES[i] = 1.0; }
        else { EVX[i] = 0.0 - chaseSpeed; ES[i] = 0.0; }
      } else if (distSq > 160000.0) {
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

    PRECT.x = P[PI_X] + POX; PRECT.y = P[PI_Y] + POY;
    ERECT.x = EX[i] + 4.0; ERECT.y = EY[i] + 4.0; ERECT.width = TILE_SIZE - 8.0; ERECT.height = TILE_SIZE - 8.0;

    if (checkCollisionRecs(PRECT, ERECT)) {
      // Check if stomping (player falling and above enemy)
      if (P[PI_VY] > 0.0 && P[PI_PBOTY] < EY[i] + 12.0 && type < 3.5) {
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

  PRECT.x = P[PI_X] + POX; PRECT.y = P[PI_Y] + POY;

  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];

    ERECT.x = CX[i] + 6.0; ERECT.y = CY[i] + 6.0; ERECT.width = 20.0; ERECT.height = 20.0;

    if (checkCollisionRecs(PRECT, ERECT)) {
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
      // Flag — BIG visible marker
      const fx = floorf(CX[i]);
      const fy = floorf(CY[i]);
      // Large bright green background glow
      bloom_draw_rect(fx - 8, fy - 128, 48, 160, 50, 255, 50, 60);
      // Tall pole
      bloom_draw_rect(fx + 14, fy - 120, 5, 152, 160, 160, 170, 255);
      // Big red banner
      bloom_draw_rect(fx + 19, fy - 116, 32, 24, 230, 40, 40, 255);
      const wave = Math.sin(t * 4.0) * 4.0;
      bloom_draw_triangle(fx + 51, fy - 116, fx + 51, fy - 92, fx + 60 + floorf(wave), fy - 104, 210, 30, 30, 255);
      // Gold ball on top
      bloom_draw_circle(fx + 16, fy - 124, 6, 255, 220, 50, 255);
      // "GOAL" text above
      drawTextRgba("GOAL", fx - 2, fy - 148, 18, 255, 255, 50, 255);
    }
  }
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera(dt: number, sw: number, sh: number): void {
  // Set zoom to UI scale so game world fills the screen proportionally
  CAM[2] = UI[UI_SCALE];

  const lookAhead = P[PI_FACE] > 0.5 ? 60.0 : -60.0;
  const targetX = P[PI_X] + TILE_SIZE * 0.5 + lookAhead;
  const targetY = P[PI_Y] - 20.0;

  CAM[0] = CAM[0] + (targetX - CAM[0]) * 6.0 * dt;
  CAM[1] = CAM[1] + (targetY - CAM[1]) * 6.0 * dt;

  // Clamp to level bounds
  const halfW = sw * 0.5 / CAM[2];
  const halfH = sh * 0.5 / CAM[2];
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

function drawSkyGradient(sw: number, sh: number): void {
  // Use fewer strips on mobile to reduce fill rate
  const steps = MOBILE > 0.5 ? 6 : 20;
  const stripH = sh / steps;
  for (let i = 0; i < steps; i = i + 1) {
    const t = i / (steps - 1.0);
    const sr = floorf(100.0 + 80.0 * t);
    const sg = floorf(180.0 + 40.0 * t);
    const sb = floorf(255.0 + 0.0 * t);
    bloom_draw_rect(0, floorf(i * stripH), sw, floorf(stripH) + 1, sr, sg, sb, 255);
  }
}

function drawParallaxBg(sw: number, sh: number): void {
  // Procedural parallax — colored triangles/rects (PNG backgrounds had artifacts)
  // Fewer iterations on mobile to reduce draw calls
  const mCount = MOBILE > 0.5 ? 8.0 : 12.0;
  const hCount = MOBILE > 0.5 ? 6.0 : 10.0;

  // Far mountains (0.15x scroll)
  const mx = CAM[0] * 0.15;
  const mBase = sh - 80;
  let mi = 0.0;
  while (mi < mCount) {
    const px = floorf(mi * 180.0 - (mx % 180.0) - 180.0);
    const h = 80.0 + (mi % 3.0) * 40.0 + (mi % 2.0) * 25.0;
    bloom_draw_triangle(px, mBase, px + 90, floorf(mBase - h), px + 180, mBase, 140, 160, 200, 100);
    mi = mi + 1.0;
  }

  // Near hills (0.35x scroll)
  const hx = CAM[0] * 0.35;
  const hBase = sh - 40;
  let hi = 0.0;
  while (hi < hCount) {
    const px = floorf(hi * 200.0 - (hx % 200.0) - 200.0);
    const h = 50.0 + (hi % 3.0) * 20.0;
    const w = 200.0;
    // Approximate hill with overlapping triangles
    bloom_draw_triangle(px, hBase, floorf(px + w * 0.5), floorf(hBase - h), px + floorf(w), hBase, 80, 150, 80, 80);
    hi = hi + 1.0;
  }
}

function drawVisibleTiles(sw: number, sh: number): void {
  const camX = CAM[0];
  const camY = CAM[1];
  const halfW = sw * 0.5 / CAM[2] + TILE_SIZE;
  const halfH = sh * 0.5 / CAM[2] + TILE_SIZE;

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

  const pBaseX = ATLAS_PLAYER_X + frame * TILE_SRC;
  const pSrcX = P[PI_FACE] > 0.5 ? pBaseX : pBaseX + TILE_SRC;
  const srcW = P[PI_FACE] > 0.5 ? TILE_SRC : 0.0 - TILE_SRC;
  bloom_draw_texture_pro(ATLAS_ID, pSrcX, ATLAS_PLAYER_Y, srcW, TILE_SRC, floorf(P[PI_X]), floorf(drawY), TILE_SIZE, floorf(drawH), 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
}

function drawHUD(sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  const iconSize = floorf(32.0 * s);
  const textSize = floorf(22.0 * s);
  const margin = floorf(10.0 * s);

  // Hearts
  for (let i = 0; i < 3; i = i + 1) {
    const hx = margin + floorf(i * 36.0 * s);
    const hy = margin;
    if (i < P[PI_HP]) {
      bloom_draw_texture_pro(UI_TEX_ID, ATLAS_UI_X, ATLAS_UI_Y, 16, 16, hx, hy, iconSize, iconSize, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
    } else {
      bloom_draw_texture_pro(UI_TEX_ID, ATLAS_UI_X + 16.0, ATLAS_UI_Y, 16, 16, hx, hy, iconSize, iconSize, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
    }
  }

  // Coin count
  const coinX = floorf(130.0 * s);
  const coinIconSize = floorf(24.0 * s);
  bloom_draw_texture_pro(UI_TEX_ID, ATLAS_UI_X + 32.0, ATLAS_UI_Y, 16, 16, coinX, floorf(14.0 * s), coinIconSize, coinIconSize, 0.0, 0.0, 0.0, 255.0, 255.0, 255.0, 255.0);
  drawTextRgba("x" + floorf(P[PI_COINS]).toString(), floorf(158.0 * s), floorf(16.0 * s), textSize, 255, 255, 255, 255);

  // Gem count
  if (P[PI_GEMS] > 0.0) {
    drawItemSprite(4, floorf(220.0 * s), margin);
    drawTextRgba("x" + floorf(P[PI_GEMS]).toString(), floorf(254.0 * s), floorf(16.0 * s), textSize, 255, 255, 255, 255);
  }

  // Lives
  const livesSize = floorf(20.0 * s);
  drawTextRgba("Lives: " + floorf(P[PI_LIVES]).toString(), sw - floorf(120.0 * s), floorf(16.0 * s), livesSize, 255, 255, 255, 255);

  // Perf debug bar
  const dbgSize = floorf(14.0 * s);
  const dbgY = sh - floorf(24.0 * s);
  bloom_draw_rect(0, dbgY - floorf(4.0 * s), sw, floorf(28.0 * s), 0, 0, 0, 220);
  drawTextRgba("FPS:" + floorf(PERF[PF_FPS]).toString() + " dt:" + floorf(PERF[PF_LASTDT] * 1000.0).toString() + "ms drw:" + floorf(PERF[PF_DRAW] * 10.0).toString() + " sky:" + floorf(PERF[6]).toString() + " til:" + floorf(PERF[7]).toString() + " wld:" + floorf(PERF[8]).toString() + " hud:" + floorf(PERF[9]).toString(), floorf(8.0 * s), dbgY, dbgSize, { r: 255, g: 255, b: 0, a: 255 });
}

// ============================================================
// MENU SCREENS
// ============================================================

function drawTitleScreen(t: number, sw: number, sh: number): void {
  drawSkyGradient(sw, sh);
  drawParallaxBg(sw, sh);
  // Dark overlay for text readability
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 30, 120);

  const s = UI[UI_SCALE];

  // Title
  const titleSize = floorf(60.0 * s);
  const titleText = "BLOOM JUMP";
  const titleW = measureText(titleText, titleSize);
  drawTextRgba(titleText, floorf((sw - titleW) / 2.0), floorf(120.0 * s), titleSize, 255, 255, 255, 255);

  // Subtitle
  const subSize = floorf(20.0 * s);
  const subText = "A Bloom Engine Platformer";
  const subW = measureText(subText, subSize);
  drawTextRgba(subText, floorf((sw - subW) / 2.0), floorf(190.0 * s), subSize, 220, 220, 255, 255);

  // Menu options
  const menuCount = 2;
  const menuSize = floorf(30.0 * s);
  const options = ["Play Game", "Info"];
  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < menuCount; i = i + 1) {
    const label = options[i];
    const oy = floorf((300.0 + i * 50.0) * s);
    const ow = measureText(label, menuSize);
    const ox = floorf((sw - ow) / 2.0);
    if (i === selIdx) {
      const pulse = Math.sin(t * 4.0) * 0.3 + 0.7;
      const alpha = floorf(255.0 * pulse);
      drawTextRgba("> " + label + " <", floorf(ox - 30.0 * s), oy, menuSize, 255, 255, 100, alpha);
    } else {
      drawTextRgba(label, ox, oy, menuSize, 200, 200, 220, 200);
    }
  }

  // Debug: paint a giant background if updateTitleScreen ran even once
  if (DBG_PROOF[0] > 0.5) {
    bloom_draw_rect(0.0, 0.0, sw, 20.0, 0, 255, 0, 255);  // solid GREEN bar top of screen
  }

  // Debug: draw hit boxes on top of menu items to visualize alignment
  if (MOBILE > 0.5) {
    for (let mi = 0; mi < 2; mi = mi + 1) {
      const itemY = floorf((300.0 + mi * 50.0) * s);
      const boxH = floorf(40.0 * s) + 10.0;
      bloom_draw_rect(floorf(sw * 0.1), itemY - 10.0, floorf(sw * 0.8), boxH, 255, 0, 0, 80);
    }
    const tc2 = getTouchCount();
    for (let ti = 0; ti < tc2; ti = ti + 1) {
      const tx = getTouchX(ti);
      const ty = getTouchY(ti);
      bloom_draw_rect(tx - 8.0, ty - 8.0, 16.0, 16.0, 0, 255, 0, 255);
    }
    // Debug counters using GSDBG[] (dedicated array): frame, touch, loop, hit
    bloom_draw_rect(5.0, 5.0,  10.0 + GSDBG[DBG_FRAME] * 0.5, 15.0, 255, 255, 0, 255);  // frames updateTitleScreen ran
    bloom_draw_rect(5.0, 25.0, 10.0 + GSDBG[DBG_TOUCH] * 8.0, 15.0, 255, 200, 0, 255);  // frames with touch
    bloom_draw_rect(5.0, 45.0, 10.0 + GSDBG[DBG_LOOP]  * 8.0, 15.0, 255, 140, 0, 255);  // outer loop entered
    bloom_draw_rect(5.0, 65.0, 10.0 + GSDBG[DBG_HIT]   * 8.0, 15.0, 255, 0,   0, 255);  // hit matched
  }

  // Instructions
  const instrSize = floorf(16.0 * s);
  if (MOBILE > 0.5) {
    const iw = measureText("Tap Play to begin", instrSize);
    drawTextRgba("Tap Play to begin", floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = measureText("Press A to select", instrSize);
    drawTextRgba("Press A to select", floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = measureText("Arrow Keys / WASD to move, SPACE to jump", instrSize);
    drawTextRgba("Arrow Keys / WASD to move, SPACE to jump", floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  }

}

function selectMenuItem(sw: number, sh: number): void {
  const sel = floorf(GS[GI_SEL]);
  if (sel === 0) {
    discoverLevels();
    GS[GI_STATE] = ST_LEVEL_SELECT;
    GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  } else if (sel === 1) {
    CRED[0] = 0.0;
    GS[GI_STATE] = ST_CREDITS;
    playSound(sndSelect);
  }
}

function updateTitleScreen(sw: number, sh: number): void {
  GSDBG[DBG_FRAME] = GSDBG[DBG_FRAME] + 1.0;
  // SANITY: if this function runs at all, change background color via a module-level array
  // that rendering will observe
  DBG_PROOF[0] = DBG_PROOF[0] + 1.0;
  const menuMax = 1.0;
  // Keyboard / gamepad navigation
  if (isKeyPressed(Key.DOWN) || isKeyPressed(Key.S) || GP[GP_DOWN] > 0.5) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] > menuMax) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.UP) || isKeyPressed(Key.W) || GP[GP_UP] > 0.5) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = menuMax;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.ENTER) || isKeyPressed(Key.SPACE) || GP[GP_CONFIRM] > 0.5) {
    selectMenuItem(sw, sh);
  }
  // Touch: tap on menu items
  if (MOBILE > 0.5) {
    const s = UI[UI_SCALE];
    const tc = getTouchCount();
    if (tc > 0.0) GSDBG[DBG_TOUCH] = GSDBG[DBG_TOUCH] + 1.0;
    for (let ti = 0; ti < tc; ti = ti + 1) {
      const tx = getTouchX(ti);
      const ty = getTouchY(ti);
      GSDBG[DBG_LOOP] = GSDBG[DBG_LOOP] + 1.0;
      if (tx > sw * 0.1 && tx < sw * 0.9) {
        for (let mi = 0; mi < 2; mi = mi + 1) {
          const itemY = floorf((300.0 + mi * 50.0) * s);
          if (ty > itemY - 10.0 && ty < itemY + floorf(40.0 * s)) {
            GSDBG[DBG_HIT] = GSDBG[DBG_HIT] + 1.0;
            GS[GI_SEL] = mi;
            selectMenuItem(sw, sh);
          }
        }
      }
    }
  }
}

// ============================================================
// CREDITS SCREEN
// ============================================================

// Credits line types: 0=gap, 1=heading, 2=subheading, 3=body, 4=small
// Each entry: [type, text]
const CREDITS_TYPE: number[] = [];
const CREDITS_TEXT: string[] = [];

function addCredit(lineType: number, text: string): void {
  CREDITS_TYPE.push(lineType);
  CREDITS_TEXT.push(text);
}

// Build credits content
addCredit(1, "BLOOM JUMP");
addCredit(0, "");
addCredit(0, "");
addCredit(2, "- A Skelpo Production -");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Produced by");
addCredit(0, "");
addCredit(3, "Skelpo GmbH");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Game Design");
addCredit(0, "");
addCredit(3, "Skelpo GmbH");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Programming");
addCredit(0, "");
addCredit(3, "Skelpo GmbH");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Art & Sound");
addCredit(0, "");
addCredit(3, "Skelpo GmbH");
addCredit(0, "");
addCredit(0, "");
addCredit(0, "");
addCredit(2, "- - - - - -");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Built with");
addCredit(0, "");
addCredit(3, "Bloom Engine");
addCredit(4, "A native game engine for TypeScript");
addCredit(0, "");
addCredit(0, "");
addCredit(1, "Compiled with");
addCredit(0, "");
addCredit(3, "Perry");
addCredit(4, "TypeScript to native code compiler");
addCredit(0, "");
addCredit(0, "");
addCredit(0, "");
addCredit(2, "- - - - - -");
addCredit(0, "");
addCredit(0, "");
addCredit(4, "No frameworks were harmed");
addCredit(4, "in the making of this game.");
addCredit(0, "");
addCredit(4, "Pure TypeScript. Compiled to native.");
addCredit(4, "No VM. No interpreter. No GC.");
addCredit(0, "");
addCredit(0, "");
addCredit(0, "");
addCredit(2, "Thank you for playing!");
addCredit(0, "");
addCredit(0, "");
addCredit(0, "");
addCredit(4, "(C) 2026 Skelpo GmbH");
addCredit(4, "All rights reserved.");

const CREDITS_SCROLL_SPEED = 40.0;

function getCreditsLineHeight(lineType: number, s: number): number {
  if (lineType < 0.5) return floorf(24.0 * s);
  if (lineType < 1.5) return floorf(50.0 * s);
  if (lineType < 2.5) return floorf(40.0 * s);
  if (lineType < 3.5) return floorf(36.0 * s);
  return floorf(28.0 * s);
}

function getCreditsLineSize(lineType: number, s: number): number {
  if (lineType < 0.5) return 0;
  if (lineType < 1.5) return floorf(36.0 * s);
  if (lineType < 2.5) return floorf(24.0 * s);
  if (lineType < 3.5) return floorf(28.0 * s);
  return floorf(16.0 * s);
}

function drawCreditsScreen(t: number, dt: number, sw: number, sh: number): void {
  clearBackground({ r: 0, g: 0, b: 0, a: 255 });

  // Starfield effect
  const starSeed = 42.0;
  for (let i = 0.0; i < 60.0; i = i + 1.0) {
    const sx = ((i * 137.5 + starSeed * 73.0) % sw);
    const rawY = ((i * 251.3 + starSeed * 41.0) % sh) - (CRED[0] * (0.2 + i % 3.0 * 0.1)) % sh;
    let sy = rawY % sh;
    if (sy < 0.0) sy = sy + sh;
    const twinkle = Math.sin(t * (2.0 + i * 0.3) + i) * 0.3 + 0.7;
    const alpha = floorf(120.0 * twinkle);
    const sz = 1.0 + (i % 3.0) * 0.5;
    bloom_draw_rect(floorf(sx), floorf(sy), floorf(sz), floorf(sz), 255, 255, 255, alpha);
  }

  const s = UI[UI_SCALE];
  const scrollY = CRED[0];

  // Calculate start Y: begin off-screen at the bottom
  let lineY = sh + 40.0 - scrollY;

  for (let i = 0; i < CREDITS_TYPE.length; i = i + 1) {
    const lineType = CREDITS_TYPE[i];
    const lineH = getCreditsLineHeight(lineType, s);
    const fontSize = getCreditsLineSize(lineType, s);

    // Skip if off screen
    if (lineY + lineH < 0.0) {
      lineY = lineY + lineH;
      continue;
    }
    if (lineY > sh) {
      lineY = lineY + lineH;
      continue;
    }

    // Fade at edges
    let alpha = 255.0;
    if (lineY < 80.0 * s) {
      alpha = 255.0 * (lineY / (80.0 * s));
      if (alpha < 0.0) alpha = 0.0;
    }
    if (lineY > sh - 60.0 * s) {
      alpha = 255.0 * ((sh - lineY) / (60.0 * s));
      if (alpha < 0.0) alpha = 0.0;
    }
    const a = floorf(alpha);

    if (fontSize > 0) {
      const text = CREDITS_TEXT[i];
      const tw = measureText(text, fontSize);
      const tx = floorf((sw - tw) / 2.0);
      const ty = floorf(lineY);

      if (lineType < 1.5) {
        // Heading — bright gold
        drawTextRgba(text, tx, ty, fontSize, 255, 220, 80, a);
      } else if (lineType < 2.5) {
        // Subheading — soft cyan
        drawTextRgba(text, tx, ty, fontSize, 120, 220, 255, a);
      } else if (lineType < 3.5) {
        // Body — white
        drawTextRgba(text, tx, ty, fontSize, 255, 255, 255, a);
      } else {
        // Small — dim
        drawTextRgba(text, tx, ty, fontSize, 160, 160, 180, a);
      }
    }

    lineY = lineY + lineH;
  }

  // Top/bottom gradient overlays for cinematic fade
  for (let g = 0.0; g < 40.0; g = g + 1.0) {
    const ga = floorf(255.0 * (1.0 - g / 40.0));
    bloom_draw_rect(0, floorf(g * s), sw, floorf(s + 1.0), 0, 0, 0, ga);
    bloom_draw_rect(0, floorf(sh - (g + 1.0) * s), sw, floorf(s + 1.0), 0, 0, 0, ga);
  }

  // Scroll
  CRED[0] = CRED[0] + CREDITS_SCROLL_SPEED * dt;

  // Calculate total height
  let totalH = sh + 40.0;
  for (let i = 0; i < CREDITS_TYPE.length; i = i + 1) {
    totalH = totalH + getCreditsLineHeight(CREDITS_TYPE[i], s);
  }
  totalH = totalH + sh * 0.5;

  // Return to menu when scrolled past everything, or on any key/touch
  let dismiss = 0.0;
  if (CRED[0] > totalH) dismiss = 1.0;
  if (isKeyPressed(Key.ESCAPE) || isKeyPressed(Key.ENTER) || isKeyPressed(Key.SPACE)) dismiss = 1.0;
  if (GP[GP_CONFIRM] > 0.5 || GP[GP_PAUSE] > 0.5) dismiss = 1.0;
  if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) dismiss = 1.0;
  if (dismiss > 0.5) {
    GS[GI_STATE] = ST_MENU;
    GS[GI_SEL] = 0.0;
  }
}

function drawLevelSelect(t: number, sw: number, sh: number): void {
  drawSkyGradient(sw, sh);
  // Dark overlay for text readability
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 30, 120);

  const s = UI[UI_SCALE];
  const titleSize = floorf(36.0 * s);
  const tw = measureText("SELECT LEVEL", titleSize);
  drawTextRgba("SELECT LEVEL", floorf((sw - tw) / 2.0), floorf(40.0 * s), titleSize, 255, 255, 255, 255);

  const count = floorf(GS[GI_LCOUNT]);
  const itemSize = floorf(24.0 * s);
  const rowH = floorf(40.0 * s);
  if (count < 1) {
    const emptySize = floorf(20.0 * s);
    drawTextRgba("No levels found in assets/levels/ directory", floorf(150.0 * s), floorf(250.0 * s), emptySize, { r: 200, g: 200, b: 200, a: 200 });
    drawTextRgba("Run the editor to create levels!", floorf(170.0 * s), floorf(290.0 * s), emptySize, 200, 200, 200, 200);
  }

  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < count; i = i + 1) {
    if (i >= LEVEL_NAMES.length) break;
    const name = LEVEL_NAMES[i];
    const oy = floorf((100.0 + i * 40.0) * s);
    if (oy > sh - floorf(80.0 * s)) break;

    if (i === selIdx) {
      bloom_draw_rect(floorf(80.0 * s), oy - floorf(4.0 * s), sw - floorf(160.0 * s), floorf(36.0 * s), 255, 255, 255, 30);
      drawTextRgba("> " + name, floorf(100.0 * s), oy, itemSize, 255, 255, 100, 255);
    } else {
      drawTextRgba(name, floorf(120.0 * s), oy, itemSize, 200, 200, 220, 200);
    }
  }

  const instrSize = floorf(18.0 * s);
  if (MOBILE > 0.5) {
    const iw = measureText("Tap a level to play", instrSize);
    drawTextRgba("Tap a level to play", floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = measureText("A to play, Menu to go back", instrSize);
    drawTextRgba("A to play, Menu to go back", floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = measureText("ENTER to play, ESC to go back", instrSize);
    drawTextRgba("ENTER to play, ESC to go back", floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  }
}

function updateLevelSelect(sw: number, sh: number): void {
  const count = floorf(GS[GI_LCOUNT]);
  // Keyboard / gamepad navigation
  if (isKeyPressed(Key.DOWN) || isKeyPressed(Key.S) || GP[GP_DOWN] > 0.5) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] >= count) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.UP) || isKeyPressed(Key.W) || GP[GP_UP] > 0.5) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = count - 1.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(Key.ENTER) || isKeyPressed(Key.SPACE) || GP[GP_CONFIRM] > 0.5) {
    if (count > 0) {
      startLevel(floorf(GS[GI_SEL]));
      GS[GI_STATE] = ST_PLAYING;
      switchMusic(2.0);
      playSound(sndSelect);
    }
  }
  if (isKeyPressed(Key.ESCAPE) || GP[GP_PAUSE] > 0.5) {
    GS[GI_STATE] = ST_MENU;
    GS[GI_SEL] = 0.0;
  }
  // Touch: tap on level rows
  if (MOBILE > 0.5) {
    const s = UI[UI_SCALE];
    const tc = getTouchCount();
    for (let ti = 0.0; ti < tc; ti = ti + 1.0) {
      const tx = getTouchX(ti);
      const ty = getTouchY(ti);
      for (let li = 0.0; li < count; li = li + 1.0) {
        const oy = (100.0 + li * 40.0) * s;
        if (ty > oy - 4.0 * s && ty < oy + 36.0 * s && tx > 40.0 * s && tx < sw - 40.0 * s) {
          startLevel(floorf(li));
          GS[GI_STATE] = ST_PLAYING;
          switchMusic(2.0);
          playSound(sndSelect);
        }
      }
    }
  }
}

function drawPauseScreen(sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 0, 150);
  const pauseSize = floorf(48.0 * s);
  const text = "PAUSED";
  const tw = measureText(text, pauseSize);
  drawTextRgba(text, floorf((sw - tw) / 2.0), floorf(220.0 * s), pauseSize, 255, 255, 255, 255);

  const btnSize = floorf(28.0 * s);
  const resumeLabel = "Resume";
  const resumeW = measureText(resumeLabel, btnSize);
  drawTextRgba(resumeLabel, floorf((sw - resumeW) / 2.0), floorf(290.0 * s), btnSize, 200, 200, 220, 200);

  const quitLabel = "Quit to Menu";
  const quitW = measureText(quitLabel, btnSize);
  drawTextRgba(quitLabel, floorf((sw - quitW) / 2.0), floorf(340.0 * s), btnSize, 200, 200, 220, 200);

  const instrSize = floorf(16.0 * s);
  if (MOBILE > 0.5) {
    const iw = measureText("Tap to Resume or Quit", instrSize);
    drawTextRgba("Tap to Resume or Quit", floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = measureText("A to Resume, Menu to Quit", instrSize);
    drawTextRgba("A to Resume, Menu to Quit", floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = measureText("ESC to Resume, Q to Quit", instrSize);
    drawTextRgba("ESC to Resume, Q to Quit", floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  }
}

function drawGameOver(sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  drawSkyGradient(sw, sh);
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 30, 120);
  const headSize = floorf(48.0 * s);
  const text = "GAME OVER";
  const tw = measureText(text, headSize);
  drawTextRgba(text, floorf((sw - tw) / 2.0), floorf(200.0 * s), headSize, 230, 60, 60, 255);

  const bodySize = floorf(24.0 * s);
  const coinsText = "Coins: " + floorf(P[PI_COINS]).toString();
  const cw = measureText(coinsText, bodySize);
  drawTextRgba(coinsText, floorf((sw - cw) / 2.0), floorf(280.0 * s), bodySize, 255, 255, 255, 255);

  const instrSize = floorf(20.0 * s);
  if (MOBILE > 0.5) {
    const iw = measureText("Tap to continue", instrSize);
    drawTextRgba("Tap to continue", floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, { r: 200, g: 200, b: 220, a: 200 });
  } else if (TV > 0.5) {
    const iw = measureText("Press A to continue", instrSize);
    drawTextRgba("Press A to continue", floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, 200, 200, 220, 200);
  } else {
    const iw = measureText("Press ENTER to continue", instrSize);
    drawTextRgba("Press ENTER to continue", floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, 200, 200, 220, 200);
  }
}

function drawLevelCompleteScreen(t: number, sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 0, 150);
  const headSize = floorf(42.0 * s);
  const text = "LEVEL COMPLETE!";
  const tw = measureText(text, headSize);
  drawTextRgba(text, floorf((sw - tw) / 2.0), floorf(180.0 * s), headSize, 255, 255, 100, 255);

  const bodySize = floorf(24.0 * s);
  const coinsText = "Coins: " + floorf(P[PI_COINS]).toString();
  const cw = measureText(coinsText, bodySize);
  drawTextRgba(coinsText, floorf((sw - cw) / 2.0), floorf(260.0 * s), bodySize, 255, 255, 255, 255);

  if (P[PI_GEMS] > 0.0) {
    const gemText = "Gems: " + floorf(P[PI_GEMS]).toString();
    const gw = measureText(gemText, bodySize);
    drawTextRgba(gemText, floorf((sw - gw) / 2.0), floorf(300.0 * s), bodySize, 50, 150, 255, 255);
  }

  const instrSize = floorf(20.0 * s);
  if (MOBILE > 0.5) {
    const iw = measureText("Tap to continue", instrSize);
    drawTextRgba("Tap to continue", floorf((sw - iw) / 2.0), floorf(380.0 * s), instrSize, 200, 200, 220, 200);
  } else if (TV > 0.5) {
    const iw = measureText("Press A to continue", instrSize);
    drawTextRgba("Press A to continue", floorf((sw - iw) / 2.0), floorf(380.0 * s), instrSize, 200, 200, 220, 200);
  } else {
    drawTextRgba("Press ENTER to continue", floorf(sw / 2.0) - 120, 380, 20, 200, 200, 220, 200);
  }
}

// ============================================================
// TOUCH CONTROLS OVERLAY
// ============================================================

function drawTouchControls(sw: number, sh: number): void {
  if (MOBILE < 0.5) return;

  const s = UI[UI_SCALE];

  // Virtual joystick (bottom-left)
  const joyR = floorf(TOUCH_JOY_RADIUS * s);
  const joyX = floorf(TOUCH_JOY_X_POS * s);
  const joyY = floorf(sh - TOUCH_JOY_Y_OFFSET * s);
  bloom_draw_circle(joyX, joyY, joyR, 255, 255, 255, 30);
  const knobX = joyX + floorf(TCH[TI_JOY_X] * joyR * 0.8);
  const knobY = joyY + floorf(TCH[TI_JOY_Y] * joyR * 0.8);
  bloom_draw_circle(floorf(knobX), floorf(knobY), floorf(20.0 * s), 255, 255, 255, 60);

  // Jump button (bottom-right)
  const jumpR = floorf(TOUCH_JUMP_RADIUS * s);
  const jumpX = floorf(sw - TOUCH_JUMP_X_OFFSET * s);
  const jumpY = floorf(sh - TOUCH_JUMP_Y_OFFSET * s);
  let jumpAlpha = 40;
  if (TCH[TI_JUMP_DOWN] > 0.5) jumpAlpha = 80;
  bloom_draw_circle(jumpX, jumpY, jumpR, 255, 255, 255, jumpAlpha);
  const jumpLabelSize = floorf(16.0 * s);
  drawTextRgba("Jump", jumpX - floorf(20.0 * s), jumpY - floorf(8.0 * s), jumpLabelSize, 255, 255, 255, 150);

  // Pause button (top-right)
  const pauseS = floorf(TOUCH_PAUSE_SIZE * s * 0.75);
  const pauseX = floorf(sw - TOUCH_PAUSE_X_OFFSET * s);
  const pauseY = floorf(TOUCH_PAUSE_Y_OFFSET * s);
  bloom_draw_rect(pauseX - pauseS, pauseY - pauseS, pauseS * 2, pauseS * 2, 255, 255, 255, 30);
  const barW = floorf(4.0 * s);
  const barH = floorf(16.0 * s);
  bloom_draw_rect(pauseX - floorf(6.0 * s), pauseY - floorf(8.0 * s), barW, barH, 255, 255, 255, 120);
  bloom_draw_rect(pauseX + floorf(2.0 * s), pauseY - floorf(8.0 * s), barW, barH, 255, 255, 255, 120);
}

// ============================================================
// MAIN GAME LOOP
// ============================================================

const camera: Camera2D = {
  offset: { x: 400.0, y: 300.0 },
  target: { x: 0.0, y: 0.0 },
  rotation: 0.0,
  zoom: 1.0,
};

// Start at title screen
GS[GI_STATE] = ST_MENU;
switchMusic(1.0);

// FPS / perf tracking (Perry-safe arrays)
const PERF = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
// [frameCount, fpsTimer, fps, updateMs, drawMs, presentMs, lastDt, dtAccum]
const PF_COUNT = 0; const PF_TIMER = 1; const PF_FPS = 2;
const PF_UPDATE = 3; const PF_DRAW = 4; const PF_PRESENT = 5;
const PF_LASTDT = 6; const PF_DTACC = 7;

while (!windowShouldClose()) {
  const dt = getDeltaTime();
  const t = getTime();
  const frameStart = getTime();

  // Dynamic screen size (mobile fills device screen, desktop uses SCREEN_W/SCREEN_H)
  const sw = getScreenWidth();
  const sh = getScreenHeight();
  camera.offset.x = sw / 2.0;
  camera.offset.y = sh / 2.0;

  // UI scale: scale all text/positions relative to design height
  // In landscape sh is shorter dim, in portrait sw is shorter
  const shortDim = sw < sh ? sw : sh;
  UI[UI_SCALE] = shortDim / DESIGN_H;

  // Update music stream (must be called every frame)
  if (MUS[0] > 0.5 && MUS[0] < 1.5) updateMusicStreamRaw(musMenu);
  if (MUS[0] > 1.5 && MUS[0] < 2.5) updateMusicStreamRaw(musGame);

  // Process platform input
  updateTouchInput(sw, sh);
  updateGamepadInput();

  beginDrawing();

  const state = floorf(GS[GI_STATE]);

  if (state === ST_MENU) {
    // === TITLE SCREEN ===
    updateTitleScreen(sw, sh);
    drawTitleScreen(t, sw, sh);

  } else if (state === ST_LEVEL_SELECT) {
    // === LEVEL SELECT ===
    updateLevelSelect(sw, sh);
    drawLevelSelect(t, sw, sh);

  } else if (state === ST_CREDITS) {
    // === CREDITS ===
    drawCreditsScreen(t, dt, sw, sh);

  } else if (state === ST_PLAYING) {
    // === GAMEPLAY ===
    const tUpdate0 = getTime();
    updatePlayer(dt);
    updateEnemies(dt);
    updateCollectibles(dt, t);
    updateParticles(dt);
    updateCamera(dt, sw, sh);
    const tUpdate1 = getTime();
    PERF[PF_UPDATE] = (tUpdate1 - tUpdate0) * 1000.0;

    // Update camera struct
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    camera.zoom = CAM[2];

    // Draw
    const tDraw0 = getTime();

    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);
    const tSky = getTime();

    beginMode2D(camera);
    drawVisibleTiles(sw, sh);
    const tTiles = getTime();
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    drawParticles();
    endMode2D();
    const tWorld = getTime();

    drawHUD(sw, sh);
    drawTouchControls(sw, sh);
    const tDraw1 = getTime();
    PERF[PF_DRAW] = (tDraw1 - tDraw0) * 1000.0;
    // Sub-timings: sky | tiles | world | hud (in tenths of ms for display)
    PERF[6] = (tSky - tDraw0) * 10000.0;
    PERF[7] = (tTiles - tSky) * 10000.0;
    PERF[8] = (tWorld - tTiles) * 10000.0;
    PERF[9] = (tDraw1 - tWorld) * 10000.0;

    // Pause
    if (isKeyPressed(Key.ESCAPE) || TCH[TI_PAUSE_PRESSED] > 0.5 || GP[GP_PAUSE] > 0.5) {
      GS[GI_STATE] = ST_PAUSED;
    }

  } else if (state === ST_PAUSED) {
    // === PAUSED ===
    // Draw game underneath
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    camera.zoom = CAM[2];
    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);
    beginMode2D(camera);
    drawVisibleTiles(sw, sh);
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD(sw, sh);
    drawPauseScreen(sw, sh);

    if (isKeyPressed(Key.ESCAPE) || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_PLAYING;
    }
    if (isKeyPressed(Key.Q) || GP[GP_PAUSE] > 0.5) {
      GS[GI_STATE] = ST_MENU;
      GS[GI_SEL] = 0.0;
      switchMusic(1.0);
    }
    // Touch: tap Resume or Quit areas
    if (MOBILE > 0.5) {
      const ps = UI[UI_SCALE];
      const tc = getTouchCount();
      for (let ti = 0.0; ti < tc; ti = ti + 1.0) {
        const ty = getTouchY(ti);
        const tx = getTouchX(ti);
        if (tx > sw * 0.2 && tx < sw * 0.8) {
          if (ty > 280.0 * ps && ty < 320.0 * ps) GS[GI_STATE] = ST_PLAYING;
          if (ty > 330.0 * ps && ty < 370.0 * ps) { GS[GI_STATE] = ST_MENU; GS[GI_SEL] = 0.0; switchMusic(1.0); }
        }
      }
    }

  } else if (state === ST_GAME_OVER) {
    // === GAME OVER ===
    drawGameOver(sw, sh);
    let goAnyTap = 0.0;
    if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) goAnyTap = 1.0;
    if (isKeyPressed(Key.ENTER) || goAnyTap > 0.5 || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL];
      P[PI_LIVES] = 3.0;
      switchMusic(1.0);
    }

  } else if (state === ST_LEVEL_COMPLETE) {
    // === LEVEL COMPLETE ===
    // Draw game underneath
    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    camera.zoom = CAM[2];
    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);
    beginMode2D(camera);
    drawVisibleTiles(sw, sh);
    drawCollectibles(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD(sw, sh);
    drawLevelCompleteScreen(t, sw, sh);

    let lcAnyTap = 0.0;
    if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) lcAnyTap = 1.0;
    if (isKeyPressed(Key.ENTER) || lcAnyTap > 0.5 || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL] + 1.0;
      if (GS[GI_SEL] >= GS[GI_LCOUNT]) GS[GI_SEL] = 0.0;
      switchMusic(1.0);
    }
  }

  const tPresent0 = getTime();
  endDrawing();
  const tPresent1 = getTime();
  PERF[PF_PRESENT] = (tPresent1 - tPresent0) * 1000.0;

  // FPS counter
  PERF[PF_LASTDT] = dt;
  PERF[PF_COUNT] = PERF[PF_COUNT] + 1.0;
  PERF[PF_DTACC] = PERF[PF_DTACC] + dt;
  if (PERF[PF_DTACC] >= 1.0) {
    PERF[PF_FPS] = PERF[PF_COUNT] / PERF[PF_DTACC];
    PERF[PF_COUNT] = 0.0;
    PERF[PF_DTACC] = 0.0;
  }
}

closeAudioDevice();
closeWindow();
