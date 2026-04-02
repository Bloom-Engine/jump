// ============================================================
// BLOOM JUMP LEVEL EDITOR — Standalone
// ============================================================

import {
  initWindow, windowShouldClose, beginDrawing, endDrawing,
  clearBackground, setTargetFPS, getDeltaTime, getTime,
  isKeyPressed, isKeyDown, isKeyReleased,
  getMouseX, getMouseY, isMouseButtonPressed, isMouseButtonDown, isMouseButtonReleased,
  getScreenWidth, getScreenHeight, closeWindow,
  beginMode2D, endMode2D, getScreenToWorld2D,
  writeFile, readFile, fileExists,
} from "bloom/core";
import { Color, Key, Camera2D, MouseButton } from "bloom/core";
import {
  drawRect, drawRectLines, drawLine,
} from "bloom/shapes";
import { drawText, measureText } from "bloom/text";
import {
  loadTexture, drawTexturePro,
  setTextureFilter, FILTER_NEAREST,
} from "bloom/textures";
import {
  initAudioDevice, closeAudioDevice, loadSound, playSound,
} from "bloom/audio";
import { clamp } from "bloom/math";
import { Texture, Sound } from "bloom/core";

// ============================================================
// CONSTANTS
// ============================================================

const SCREEN_W = 960;
const SCREEN_H = 640;
const TILE_SRC = 16;
const TILE_SIZE = 32;
const PALETTE_W = 160;
const TOOLBAR_H = 40;
const STATUS_H = 30;
const CANVAS_W = SCREEN_W - PALETTE_W;
const CANVAS_H = SCREEN_H - TOOLBAR_H - STATUS_H;

// Tile types (must match game — all floats for Perry safety)
const T_AIR = 0.0;
const T_GRASS = 1.0;
const T_DIRT = 2.0;
const T_BRICK = 3.0;
const T_STONE = 4.0;
const T_SPIKE_UP = 5.0;
const T_SPIKE_DN = 6.0;
const T_PLATFORM = 7.0;
const TILE_COUNT = 8.0;

// Entity types
const E_WALKER = 1.0;
const E_FLYER = 2.0;
const E_CHASER = 3.0;
const E_COIN = 10.0;
const E_GEM = 11.0;
const E_SPRING = 12.0;
const E_FLAG = 20.0;
const E_SPAWN = 99.0;

// Editor modes
const MODE_TILE = 0.0;
const MODE_ENTITY = 1.0;
const MODE_ERASE = 2.0;

// Colors
const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };
const BLACK: Color = { r: 0, g: 0, b: 0, a: 255 };
const GRAY: Color = { r: 40, g: 40, b: 50, a: 255 };
const DARK_BG: Color = { r: 30, g: 30, b: 40, a: 255 };
const TOOLBAR_BG: Color = { r: 50, g: 50, b: 65, a: 255 };
const PALETTE_BG: Color = { r: 35, g: 35, b: 48, a: 240 };
const HIGHLIGHT: Color = { r: 255, g: 255, b: 100, a: 255 };
const GRID_COLOR: Color = { r: 255, g: 255, b: 255, a: 30 };
const CURSOR_COLOR: Color = { r: 255, g: 255, b: 255, a: 80 };
const CANVAS_BG: Color = { r: 60, g: 70, b: 90, a: 255 };
const LEVEL_BG: Color = { r: 100, g: 180, b: 255, a: 80 };
const BTN_COLOR: Color = { r: 60, g: 60, b: 78, a: 255 };
const BTN_HOVER: Color = { r: 80, g: 80, b: 100, a: 255 };
const BTN_BORDER: Color = { r: 100, g: 100, b: 120, a: 255 };
const BORDER_COLOR: Color = { r: 255, g: 255, b: 255, a: 60 };
const LABEL_COLOR: Color = { r: 180, g: 180, b: 200, a: 200 };
const DIM_LABEL: Color = { r: 140, g: 140, b: 160, a: 160 };
const SEL_BG: Color = { r: 255, g: 255, b: 100, a: 40 };
const ERASE_BG: Color = { r: 255, g: 100, b: 100, a: 40 };
const ERASE_BORDER: Color = { r: 255, g: 100, b: 100, a: 255 };
const ERASE_BTN: Color = { r: 180, g: 60, b: 60, a: 200 };
const SPAWN_BODY: Color = { r: 80, g: 140, b: 230, a: 150 };
const SPAWN_CAP: Color = { r: 200, g: 60, b: 50, a: 150 };
const SPAWN_BORDER: Color = { r: 80, g: 200, b: 80, a: 180 };
const SPAWN_BODY2: Color = { r: 80, g: 140, b: 230, a: 200 };
const SPAWN_CAP2: Color = { r: 200, g: 60, b: 50, a: 200 };
const DLG_OVERLAY: Color = { r: 0, g: 0, b: 0, a: 150 };
const DLG_BG: Color = { r: 45, g: 45, b: 60, a: 250 };
const DLG_BORDER: Color = { r: 100, g: 100, b: 130, a: 255 };
const DLG_HINT: Color = { r: 160, g: 160, b: 180, a: 180 };
const DLG_HOVER: Color = { r: 255, g: 255, b: 255, a: 25 };

// ============================================================
// STATE
// ============================================================

// Editor state [mode, selectedTile, selectedEntity, showGrid, zoom, modified,
//               currentFileIdx, undoCount, redoCount, dialogOpen, dialogType, levelWidth, levelHeight]
const ED = [0.0, 1.0, 1.0, 1.0, 1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, 60.0, 15.0];
const EDI_MODE = 0; const EDI_TILE = 1; const EDI_ENT = 2; const EDI_GRID = 3;
const EDI_ZOOM = 4; const EDI_MOD = 5; const EDI_FILE = 6; const EDI_UNDO = 7;
const EDI_REDO = 8; const EDI_DLG = 9; const EDI_DLGT = 10; const EDI_LW = 11; const EDI_LH = 12;

// Camera
const CAM = [0.0, 0.0]; // [x, y] - camera target in world coords

// Tile data
const TILES: number[] = [];

// Entity data (parallel arrays, max 200)
const MAX_ENTITIES = 200;
const ENT_X: number[] = [];
const ENT_Y: number[] = [];
const ENT_T: number[] = [];
const ENT_A: number[] = [];

// Undo: store snapshots as flat arrays in a ring buffer
// Each snapshot is stored in UNDO_DATA at offset i*MAX_TILES
const MAX_UNDO = 20;
const MAX_TILES_UNDO = 2000; // max tiles per snapshot
const UNDO_DATA: number[] = [];
const REDO_DATA: number[] = [];
const UNDO_SIZES: number[] = []; // how many tiles in each snapshot
const REDO_SIZES: number[] = [];
const UNDO_INFO = [0.0, 0.0]; // [undoCount, redoCount]

// Last paint position (for drag detection)
const PAINT = [0.0, 0.0, 0.0]; // [lastTileX, lastTileY, painting]

// Cursor tile position (computed once per frame, used by status bar)
const CURSOR_TILE = [0.0, 0.0]; // [tileX, tileY]

// Spawn point
const SPAWN = [3.0, 12.0];

// Current filename stored as array for Perry safety
const FNAME: string[] = [""];

// File list for open dialog
const FILE_LIST: string[] = [];
const FILE_NAMES: string[] = [];

// ============================================================
// INIT
// ============================================================

initWindow(SCREEN_W, SCREEN_H, "Bloom Jump Editor");
setTargetFPS(60);
initAudioDevice();

const texTileset = loadTexture("assets/sprites/tileset.png");
setTextureFilter(texTileset, FILTER_NEAREST);
const texEnemies = loadTexture("assets/sprites/enemies.png");
setTextureFilter(texEnemies, FILTER_NEAREST);
const texItems = loadTexture("assets/sprites/items.png");
setTextureFilter(texItems, FILTER_NEAREST);

const sndSelect = loadSound("assets/sounds/select.wav");

// Init entity pool
for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
  ENT_X.push(0.0); ENT_Y.push(0.0); ENT_T.push(0.0); ENT_A.push(0.0);
}

// ============================================================
// HELPERS
// ============================================================

function floorf(a: number): number { return Math.floor(a); }
function absf(a: number): number { if (a < 0.0) return 0.0 - a; return a; }

function getTile(tx: number, ty: number): number {
  const w = floorf(ED[EDI_LW]);
  const h = floorf(ED[EDI_LH]);
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return T_AIR;
  const idx = floorf(ty) * w + floorf(tx);
  if (idx < 0 || idx >= TILES.length) return T_AIR;
  return TILES[idx];
}

function setTile(tx: number, ty: number, val: number): void {
  const w = floorf(ED[EDI_LW]);
  const h = floorf(ED[EDI_LH]);
  if (tx < 0 || tx >= w || ty < 0 || ty >= h) return;
  const idx = floorf(ty) * w + floorf(tx);
  if (idx >= 0 && idx < TILES.length) {
    TILES[idx] = val;
    ED[EDI_MOD] = 1.0;
  }
}

function drawTileSprite(tileType: number, sx: number, sy: number, size: number): void {
  if (tileType <= T_AIR) return;
  const col = (tileType - 1) % 8;
  const row = floorf((tileType - 1) / 8);
  drawTexturePro(
    texTileset,
    { x: col * TILE_SRC, y: row * TILE_SRC, width: TILE_SRC, height: TILE_SRC },
    { x: sx, y: sy, width: size, height: size },
    { x: 0.0, y: 0.0 }, 0.0, WHITE,
  );
}

function drawEntityIcon(type: number, sx: number, sy: number, size: number): void {
  if (type === E_WALKER) {
    drawTexturePro(texEnemies, { x: 0, y: 0, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_FLYER) {
    drawTexturePro(texEnemies, { x: 0, y: 16, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_CHASER) {
    drawTexturePro(texEnemies, { x: 0, y: 32, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_COIN) {
    drawTexturePro(texItems, { x: 0, y: 0, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_GEM) {
    drawTexturePro(texItems, { x: 64, y: 0, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_SPRING) {
    drawTexturePro(texItems, { x: 80, y: 0, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_FLAG) {
    drawTexturePro(texItems, { x: 112, y: 0, width: 16, height: 16 }, { x: sx, y: sy, width: size, height: size }, { x: 0, y: 0 }, 0.0, WHITE);
  } else if (type === E_SPAWN) {
    // Draw a small player-like marker
    drawRect(floorf(sx + size * 0.25), floorf(sy + size * 0.1), floorf(size * 0.5), floorf(size * 0.8), SPAWN_BODY2);
    drawRect(floorf(sx + size * 0.3), floorf(sy), floorf(size * 0.5), floorf(size * 0.25), SPAWN_CAP2); // cap
  }
}

// ============================================================
// LEVEL DATA
// ============================================================

function initNewLevel(w: number, h: number): void {
  ED[EDI_LW] = w;
  ED[EDI_LH] = h;
  TILES.length = 0;
  const total = floorf(w) * floorf(h);
  for (let i = 0; i < total; i = i + 1) TILES.push(T_AIR);

  // Ground row at bottom
  for (let x = 0; x < w; x = x + 1) {
    setTile(x, floorf(h) - 1, T_DIRT);
    setTile(x, floorf(h) - 2, T_GRASS);
  }

  // Clear entities
  for (let i = 0; i < MAX_ENTITIES; i = i + 1) ENT_A[i] = 0.0;

  SPAWN[0] = 3.0;
  SPAWN[1] = h - 3.0;

  // Clear undo
  UNDO_INFO[0] = 0.0;
  UNDO_INFO[1] = 0.0;

  ED[EDI_MOD] = 0.0;
  FNAME[0] = "";
  ED[EDI_FILE] = -1.0;

  // Center camera
  CAM[0] = w * TILE_SIZE * 0.5;
  CAM[1] = h * TILE_SIZE * 0.5;
}

function parseNumber(s: string): number {
  let result = 0.0;
  let negative = false;
  let i = 0;
  if (i < s.length && s.charAt(i) === '-') { negative = true; i = i + 1; }
  while (i < s.length) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) result = result * 10.0 + (c - 48);
    i = i + 1;
  }
  if (negative) result = 0.0 - result;
  return result;
}

function splitByChar(s: string, ch: string): string[] {
  const result: string[] = [];
  let current = "";
  for (let i = 0; i < s.length; i = i + 1) {
    if (s.charAt(i) === ch) {
      result.push(current);
      current = "";
    } else {
      current = current + s.charAt(i);
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

function loadLevelFromFile(path: string): void {
  if (!fileExists(path)) return;
  const data = readFile(path);
  const lines = splitByChar(data, "\n");

  for (let i = 0; i < MAX_ENTITIES; i = i + 1) ENT_A[i] = 0.0;
  TILES.length = 0;
  let entIdx = 0;

  for (let li = 0; li < lines.length; li = li + 1) {
    const line = lines[li];
    if (line.length < 3) continue;
    let colonPos = -1;
    for (let ci = 0; ci < line.length; ci = ci + 1) {
      if (line.charAt(ci) === ':') { colonPos = ci; break; }
    }
    if (colonPos < 0) continue;

    let key = "";
    for (let ci = 0; ci < colonPos; ci = ci + 1) key = key + line.charAt(ci);
    let val = "";
    for (let ci = colonPos + 1; ci < line.length; ci = ci + 1) val = val + line.charAt(ci);

    if (key === "width") ED[EDI_LW] = parseNumber(val);
    else if (key === "height") ED[EDI_LH] = parseNumber(val);
    else if (key === "spawn") {
      const parts = splitByChar(val, ",");
      if (parts.length >= 2) { SPAWN[0] = parseNumber(parts[0]); SPAWN[1] = parseNumber(parts[1]); }
    } else if (key === "tiles") {
      const tileStrs = splitByChar(val, ",");
      for (let ti = 0; ti < tileStrs.length; ti = ti + 1) TILES.push(parseNumber(tileStrs[ti]));
    } else if (key === "entities") {
      const entStrs = splitByChar(val, ";");
      for (let ei = 0; ei < entStrs.length; ei = ei + 1) {
        const parts = splitByChar(entStrs[ei], ",");
        if (parts.length >= 3 && entIdx < MAX_ENTITIES) {
          ENT_T[entIdx] = parseNumber(parts[0]);
          ENT_X[entIdx] = parseNumber(parts[1]);
          ENT_Y[entIdx] = parseNumber(parts[2]);
          ENT_A[entIdx] = 1.0;
          entIdx = entIdx + 1;
        }
      }
    }
  }

  // Fill tiles
  const total = floorf(ED[EDI_LW]) * floorf(ED[EDI_LH]);
  while (TILES.length < total) TILES.push(T_AIR);

  UNDO_INFO[0] = 0.0;
  UNDO_INFO[1] = 0.0;
  ED[EDI_MOD] = 0.0;

  CAM[0] = ED[EDI_LW] * TILE_SIZE * 0.5;
  CAM[1] = ED[EDI_LH] * TILE_SIZE * 0.5;
}

function saveLevelToFile(path: string): void {
  let data = "name:Custom Level\n";
  data = data + "width:" + floorf(ED[EDI_LW]).toString() + "\n";
  data = data + "height:" + floorf(ED[EDI_LH]).toString() + "\n";
  data = data + "bg:0\n";
  data = data + "spawn:" + floorf(SPAWN[0]).toString() + "," + floorf(SPAWN[1]).toString() + "\n";

  // Tiles
  data = data + "tiles:";
  for (let i = 0; i < TILES.length; i = i + 1) {
    if (i > 0) data = data + ",";
    data = data + floorf(TILES[i]).toString();
  }
  data = data + "\n";

  // Entities
  data = data + "entities:";
  let entCount = 0.0;
  for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
    if (ENT_A[i] < 0.5) continue;
    if (entCount > 0.0) data = data + ";";
    data = data + floorf(ENT_T[i]).toString() + "," + floorf(ENT_X[i]).toString() + "," + floorf(ENT_Y[i]).toString();
    entCount = entCount + 1.0;
  }
  data = data + "\n";

  writeFile(path, data);
  ED[EDI_MOD] = 0.0;
  FNAME[0] = path;
}

// ============================================================
// UNDO/REDO
// ============================================================

function pushUndo(): void {
  // Store current tile state into undo ring buffer
  const count = floorf(UNDO_INFO[0]);
  const tileCount = TILES.length;
  if (tileCount > MAX_TILES_UNDO) return; // too big to undo

  // Make sure undo data array is big enough
  const neededSize = (count + 1) * MAX_TILES_UNDO;
  while (UNDO_DATA.length < neededSize) UNDO_DATA.push(0.0);
  while (UNDO_SIZES.length <= count) UNDO_SIZES.push(0.0);

  // Copy tiles into slot
  const offset = count * MAX_TILES_UNDO;
  for (let i = 0; i < tileCount; i = i + 1) UNDO_DATA[offset + i] = TILES[i];
  UNDO_SIZES[count] = tileCount;
  UNDO_INFO[0] = count + 1.0;

  // Cap at MAX_UNDO
  if (UNDO_INFO[0] > MAX_UNDO) UNDO_INFO[0] = MAX_UNDO;

  // Clear redo
  UNDO_INFO[1] = 0.0;
}

function doUndo(): void {
  const count = floorf(UNDO_INFO[0]);
  if (count < 1) return;

  // Save current to redo
  const redoCount = floorf(UNDO_INFO[1]);
  const tileCount = TILES.length;
  const redoNeeded = (redoCount + 1) * MAX_TILES_UNDO;
  while (REDO_DATA.length < redoNeeded) REDO_DATA.push(0.0);
  while (REDO_SIZES.length <= redoCount) REDO_SIZES.push(0.0);
  const redoOff = redoCount * MAX_TILES_UNDO;
  for (let i = 0; i < tileCount; i = i + 1) REDO_DATA[redoOff + i] = TILES[i];
  REDO_SIZES[redoCount] = tileCount;
  UNDO_INFO[1] = redoCount + 1.0;

  // Restore from undo
  const idx = count - 1;
  const undoOff = idx * MAX_TILES_UNDO;
  const snapLen = floorf(UNDO_SIZES[idx]);
  for (let i = 0; i < snapLen; i = i + 1) {
    if (i < TILES.length) TILES[i] = UNDO_DATA[undoOff + i];
  }
  UNDO_INFO[0] = idx;
  ED[EDI_MOD] = 1.0;
}

function doRedo(): void {
  const redoCount = floorf(UNDO_INFO[1]);
  if (redoCount < 1) return;

  // Save current to undo
  const undoCount = floorf(UNDO_INFO[0]);
  const tileCount = TILES.length;
  const undoNeeded = (undoCount + 1) * MAX_TILES_UNDO;
  while (UNDO_DATA.length < undoNeeded) UNDO_DATA.push(0.0);
  while (UNDO_SIZES.length <= undoCount) UNDO_SIZES.push(0.0);
  const undoOff = undoCount * MAX_TILES_UNDO;
  for (let i = 0; i < tileCount; i = i + 1) UNDO_DATA[undoOff + i] = TILES[i];
  UNDO_SIZES[undoCount] = tileCount;
  UNDO_INFO[0] = undoCount + 1.0;

  // Restore from redo
  const idx = redoCount - 1;
  const redoOff = idx * MAX_TILES_UNDO;
  const snapLen = floorf(REDO_SIZES[idx]);
  for (let i = 0; i < snapLen; i = i + 1) {
    if (i < TILES.length) TILES[i] = REDO_DATA[redoOff + i];
  }
  UNDO_INFO[1] = idx;
  ED[EDI_MOD] = 1.0;
}

// ============================================================
// FILE DISCOVERY
// ============================================================

function discoverFiles(): void {
  FILE_LIST.length = 0;
  FILE_NAMES.length = 0;
  for (let i = 1; i <= 10; i = i + 1) {
    const path = "assets/levels/level" + i.toString() + ".txt";
    if (fileExists(path)) { FILE_LIST.push(path); FILE_NAMES.push("Level " + i.toString()); }
  }
  for (let i = 1; i <= 30; i = i + 1) {
    const path = "assets/levels/custom_" + i.toString() + ".txt";
    if (fileExists(path)) { FILE_LIST.push(path); FILE_NAMES.push("Custom " + i.toString()); }
  }
}

function findNextCustomName(): string {
  for (let i = 1; i <= 99; i = i + 1) {
    const path = "assets/levels/custom_" + i.toString() + ".txt";
    if (!fileExists(path)) return path;
  }
  return "assets/levels/custom_99.txt";
}

// ============================================================
// UI DRAWING
// ============================================================

function drawToolbar(): void {
  drawRect(0, 0, SCREEN_W, TOOLBAR_H, TOOLBAR_BG);

  // Buttons
  const buttons = ["New", "Open", "Save", "SaveAs"];
  const btnW = 70;
  for (let i = 0; i < 4; i = i + 1) {
    const bx = 10 + i * (btnW + 8);
    const by = 6;
    const label = buttons[i];
    const hover = getMouseX() >= bx && getMouseX() < bx + btnW && getMouseY() >= by && getMouseY() < by + 28;
    drawRect(bx, by, btnW, 28, hover ? BTN_HOVER : BTN_COLOR);
    drawRectLines(bx, by, btnW, 28, 1, BTN_BORDER);
    drawText(label, bx + 8, by + 5, 18, WHITE);
  }

  // Zoom display
  const zoomText = "Zoom: " + floorf(ED[EDI_ZOOM] * 100.0).toString() + "%";
  drawText(zoomText, CANVAS_W - 130, 12, 16, LABEL_COLOR);

  // Grid toggle
  const gridText = ED[EDI_GRID] > 0.5 ? "[G]rid: ON" : "[G]rid: OFF";
  drawText(gridText, CANVAS_W - 280, 12, 16, LABEL_COLOR);

  // Undo/redo info
  drawText("Ctrl+Z/Y", 360, 12, 14, DIM_LABEL);
}

function drawPalette(): void {
  const px = CANVAS_W;
  drawRect(px, TOOLBAR_H, PALETTE_W, CANVAS_H + STATUS_H, PALETTE_BG);

  // Tiles section
  drawText("TILES", px + 10, TOOLBAR_H + 8, 16, HIGHLIGHT);

  const tileNames = ["Grass", "Dirt", "Brick", "Stone", "Spike^", "Spikev", "Platfm"];
  for (let i = 0; i < 7; i = i + 1) {
    const ty = TOOLBAR_H + 30 + i * 38;
    const isSelected = ED[EDI_MODE] < 0.5 && floorf(ED[EDI_TILE]) === (i + 1);

    if (isSelected) {
      drawRect(px + 2, ty - 2, PALETTE_W - 4, 36, SEL_BG);
      drawRectLines(px + 2, ty - 2, PALETTE_W - 4, 36, 1, HIGHLIGHT);
    }

    drawTileSprite(i + 1, px + 8, ty, 30);
    drawText(tileNames[i], px + 44, ty + 6, 16, WHITE);
  }

  // Entities section
  const entY = TOOLBAR_H + 30 + 7 * 38 + 10;
  drawText("ENTITIES", px + 10, entY, 16, HIGHLIGHT);

  const entTypes = [E_WALKER, E_FLYER, E_CHASER, E_COIN, E_GEM, E_SPRING, E_FLAG, E_SPAWN];
  const entNames = ["Walker", "Flyer", "Chaser", "Coin", "Gem", "Spring", "Flag", "Spawn"];

  for (let i = 0; i < 8; i = i + 1) {
    const ey = entY + 22 + i * 32;
    const isSelected = ED[EDI_MODE] > 0.5 && ED[EDI_MODE] < 1.5 && floorf(ED[EDI_ENT]) === entTypes[i];

    if (isSelected) {
      drawRect(px + 2, ey - 2, PALETTE_W - 4, 30, SEL_BG);
      drawRectLines(px + 2, ey - 2, PALETTE_W - 4, 30, 1, HIGHLIGHT);
    }

    drawEntityIcon(entTypes[i], px + 8, ey, 26);
    drawText(entNames[i], px + 40, ey + 4, 14, WHITE);
  }

  // Erase button
  const eraseY = entY + 22 + 8 * 32 + 8;
  const isErase = ED[EDI_MODE] > 1.5;
  if (isErase) {
    drawRect(px + 2, eraseY - 2, PALETTE_W - 4, 30, ERASE_BG);
    drawRectLines(px + 2, eraseY - 2, PALETTE_W - 4, 30, 1, ERASE_BORDER);
  }
  drawRect(px + 8, eraseY, 26, 26, ERASE_BTN);
  drawText("X", px + 15, eraseY + 4, 18, WHITE);
  drawText("Erase", px + 40, eraseY + 4, 14, WHITE);
}

function drawStatusBar(): void {
  const sy = SCREEN_H - STATUS_H;
  drawRect(0, sy, SCREEN_W, STATUS_H, TOOLBAR_BG);

  let statusText = FNAME[0].length > 0 ? FNAME[0] : "(unsaved)";
  if (ED[EDI_MOD] > 0.5) statusText = statusText + " *";
  drawText(statusText, 10, sy + 7, 14, LABEL_COLOR);

  const sizeText = floorf(ED[EDI_LW]).toString() + " x " + floorf(ED[EDI_LH]).toString();
  drawText(sizeText, 300, sy + 7, 14, LABEL_COLOR);

  // Cursor tile position (computed in main loop)
  const posText = "Tile: " + floorf(CURSOR_TILE[0]).toString() + "," + floorf(CURSOR_TILE[1]).toString();
  drawText(posText, 480, sy + 7, 14, LABEL_COLOR);
}

function drawGrid(cam: Camera2D): void {
  if (ED[EDI_GRID] < 0.5) return;
  const w = floorf(ED[EDI_LW]);
  const h = floorf(ED[EDI_LH]);
  const zm = ED[EDI_ZOOM];
  const ghw = (CANVAS_W * 0.5) / zm + TILE_SIZE;
  const ghh = (CANVAS_H * 0.5) / zm + TILE_SIZE;
  let gsc = floorf((CAM[0] - ghw) / TILE_SIZE);
  let gec = floorf((CAM[0] + ghw) / TILE_SIZE) + 1;
  let gsr = floorf((CAM[1] - ghh) / TILE_SIZE);
  let ger = floorf((CAM[1] + ghh) / TILE_SIZE) + 1;
  if (gsc < 0) gsc = 0;
  if (gsr < 0) gsr = 0;
  if (gec > w) gec = w;
  if (ger > h) ger = h;
  const gridTop = gsr * TILE_SIZE;
  const gridBot = ger * TILE_SIZE;
  const gridLeft = gsc * TILE_SIZE;
  const gridRight = gec * TILE_SIZE;
  // Vertical lines
  for (let x = gsc; x <= gec; x = x + 1) {
    drawLine(x * TILE_SIZE, gridTop, x * TILE_SIZE, gridBot, 1, GRID_COLOR);
  }
  // Horizontal lines
  for (let y = gsr; y <= ger; y = y + 1) {
    drawLine(gridLeft, y * TILE_SIZE, gridRight, y * TILE_SIZE, 1, GRID_COLOR);
  }
}

function drawLevelBorder(): void {
  const w = ED[EDI_LW] * TILE_SIZE;
  const h = ED[EDI_LH] * TILE_SIZE;
  drawRectLines(0, 0, floorf(w), floorf(h), 2, BORDER_COLOR);
}

function drawSpawnMarker(): void {
  const sx = SPAWN[0] * TILE_SIZE;
  const sy = SPAWN[1] * TILE_SIZE;
  drawRect(floorf(sx + 8), floorf(sy + 2), 16, 28, SPAWN_BODY);
  drawRect(floorf(sx + 6), floorf(sy - 2), 20, 8, SPAWN_CAP); // cap
  drawRectLines(floorf(sx), floorf(sy), TILE_SIZE, TILE_SIZE, 1, SPAWN_BORDER);
  drawText("P", floorf(sx + 11), floorf(sy + 8), 16, WHITE);
}

function drawEntitiesInLevel(): void {
  const zm = ED[EDI_ZOOM];
  const ehw = (CANVAS_W * 0.5) / zm + TILE_SIZE;
  const ehh = (CANVAS_H * 0.5) / zm + TILE_SIZE;
  const eMinX = CAM[0] - ehw;
  const eMaxX = CAM[0] + ehw;
  const eMinY = CAM[1] - ehh;
  const eMaxY = CAM[1] + ehh;
  for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
    if (ENT_A[i] < 0.5) continue;
    const ex = ENT_X[i] * TILE_SIZE;
    const ey = ENT_Y[i] * TILE_SIZE;
    if (ex < eMinX || ex > eMaxX || ey < eMinY || ey > eMaxY) continue;
    drawEntityIcon(floorf(ENT_T[i]), floorf(ex), floorf(ey), TILE_SIZE);
  }
}

// ============================================================
// OPEN DIALOG
// ============================================================

function drawOpenDialog(): void {
  const dlgW = 400;
  const dlgH = 400;
  const dlgX = floorf((SCREEN_W - dlgW) / 2);
  const dlgY = floorf((SCREEN_H - dlgH) / 2);

  drawRect(0, 0, SCREEN_W, SCREEN_H, DLG_OVERLAY);
  drawRect(dlgX, dlgY, dlgW, dlgH, DLG_BG);
  drawRectLines(dlgX, dlgY, dlgW, dlgH, 2, DLG_BORDER);

  drawText("Open Level", dlgX + 20, dlgY + 12, 22, WHITE);
  drawText("ESC to cancel", dlgX + dlgW - 130, dlgY + 16, 14, DLG_HINT);

  for (let i = 0; i < FILE_NAMES.length; i = i + 1) {
    const fy = dlgY + 50 + i * 32;
    if (fy > dlgY + dlgH - 40) break;
    const hover = getMouseX() >= dlgX + 10 && getMouseX() < dlgX + dlgW - 10 && getMouseY() >= fy && getMouseY() < fy + 28;
    if (hover) {
      drawRect(dlgX + 10, fy, dlgW - 20, 28, DLG_HOVER);
    }
    drawText(FILE_NAMES[i], dlgX + 20, fy + 5, 18, WHITE);
    drawText(FILE_LIST[i], dlgX + 200, fy + 8, 12, DIM_LABEL);
  }
}

function updateOpenDialog(): void {
  if (isKeyPressed(Key.ESCAPE)) {
    ED[EDI_DLG] = 0.0;
    return;
  }

  if (isMouseButtonPressed(MouseButton.LEFT)) {
    const dlgW = 400;
    const dlgH = 400;
    const dlgX = floorf((SCREEN_W - dlgW) / 2);
    const dlgY = floorf((SCREEN_H - dlgH) / 2);

    for (let i = 0; i < FILE_NAMES.length; i = i + 1) {
      const fy = dlgY + 50 + i * 32;
      if (getMouseX() >= dlgX + 10 && getMouseX() < dlgX + dlgW - 10 && getMouseY() >= fy && getMouseY() < fy + 28) {
        loadLevelFromFile(FILE_LIST[i]);
        FNAME[0] = FILE_LIST[i];
        ED[EDI_DLG] = 0.0;
        playSound(sndSelect);
        return;
      }
    }
  }
}

// ============================================================
// UPDATE
// ============================================================

function handleToolbarClicks(): void {
  if (!isMouseButtonPressed(MouseButton.LEFT)) return;
  if (getMouseY() > TOOLBAR_H) return;

  const mx = getMouseX();
  const btnW = 70;

  // New
  if (mx >= 10 && mx < 10 + btnW) {
    initNewLevel(60, 15);
    playSound(sndSelect);
    return;
  }
  // Open
  if (mx >= 10 + btnW + 8 && mx < 10 + 2 * (btnW + 8)) {
    discoverFiles();
    ED[EDI_DLG] = 1.0;
    playSound(sndSelect);
    return;
  }
  // Save
  if (mx >= 10 + 2 * (btnW + 8) && mx < 10 + 3 * (btnW + 8)) {
    if (FNAME[0].length > 0) {
      saveLevelToFile(FNAME[0]);
    } else {
      const path = findNextCustomName();
      saveLevelToFile(path);
    }
    playSound(sndSelect);
    return;
  }
  // Save As
  if (mx >= 10 + 3 * (btnW + 8) && mx < 10 + 4 * (btnW + 8)) {
    const path = findNextCustomName();
    saveLevelToFile(path);
    playSound(sndSelect);
    return;
  }
}

function handlePaletteClicks(): void {
  if (!isMouseButtonPressed(MouseButton.LEFT)) return;
  const mx = getMouseX();
  const my = getMouseY();
  if (mx < CANVAS_W) return;

  // Tile selection
  for (let i = 0; i < 7; i = i + 1) {
    const ty = TOOLBAR_H + 30 + i * 38;
    if (my >= ty - 2 && my < ty + 34) {
      ED[EDI_MODE] = MODE_TILE;
      ED[EDI_TILE] = i + 1.0;
      playSound(sndSelect);
      return;
    }
  }

  // Entity selection
  const entY = TOOLBAR_H + 30 + 7 * 38 + 10;
  const entTypes = [E_WALKER, E_FLYER, E_CHASER, E_COIN, E_GEM, E_SPRING, E_FLAG, E_SPAWN];
  for (let i = 0; i < 8; i = i + 1) {
    const ey = entY + 22 + i * 32;
    if (my >= ey - 2 && my < ey + 28) {
      ED[EDI_MODE] = MODE_ENTITY;
      ED[EDI_ENT] = entTypes[i];
      playSound(sndSelect);
      return;
    }
  }

  // Erase button
  const eraseY = entY + 22 + 8 * 32 + 8;
  if (my >= eraseY - 2 && my < eraseY + 28) {
    ED[EDI_MODE] = MODE_ERASE;
    playSound(sndSelect);
  }
}

function handleCanvasInput(cam: Camera2D): void {
  const mx = getMouseX();
  const my = getMouseY();

  // Only interact with canvas area
  if (mx >= CANVAS_W || my < TOOLBAR_H || my > SCREEN_H - STATUS_H) return;

  const world = getScreenToWorld2D({ x: mx, y: my }, cam);
  const tileX = floorf(world.x / TILE_SIZE);
  const tileY = floorf(world.y / TILE_SIZE);

  // Left click = place
  if (isMouseButtonPressed(MouseButton.LEFT)) {
    pushUndo();
    PAINT[2] = 1.0;
  }

  if (isMouseButtonDown(MouseButton.LEFT) && PAINT[2] > 0.5) {
    const mode = floorf(ED[EDI_MODE]);
    if (mode === MODE_TILE) {
      setTile(tileX, tileY, floorf(ED[EDI_TILE]));
    } else if (mode === MODE_ENTITY) {
      const entType = floorf(ED[EDI_ENT]);
      if (entType === E_SPAWN) {
        SPAWN[0] = tileX;
        SPAWN[1] = tileY;
        ED[EDI_MOD] = 1.0;
      } else {
        // Check if entity already at this position
        let found = false;
        for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
          if (ENT_A[i] > 0.5 && floorf(ENT_X[i]) === tileX && floorf(ENT_Y[i]) === tileY) {
            found = true;
            break;
          }
        }
        if (!found) {
          // Find free slot
          for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
            if (ENT_A[i] < 0.5) {
              ENT_X[i] = tileX;
              ENT_Y[i] = tileY;
              ENT_T[i] = entType;
              ENT_A[i] = 1.0;
              ED[EDI_MOD] = 1.0;
              break;
            }
          }
        }
      }
    } else if (mode === MODE_ERASE) {
      setTile(tileX, tileY, T_AIR);
      // Also remove entities at this tile
      for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
        if (ENT_A[i] > 0.5 && floorf(ENT_X[i]) === tileX && floorf(ENT_Y[i]) === tileY) {
          ENT_A[i] = 0.0;
        }
      }
    }
  }

  if (isMouseButtonReleased(MouseButton.LEFT)) {
    PAINT[2] = 0.0;
  }

  // Right click = erase
  if (isMouseButtonDown(MouseButton.RIGHT)) {
    if (isMouseButtonPressed(MouseButton.RIGHT)) pushUndo();
    setTile(tileX, tileY, T_AIR);
    for (let i = 0; i < MAX_ENTITIES; i = i + 1) {
      if (ENT_A[i] > 0.5 && floorf(ENT_X[i]) === tileX && floorf(ENT_Y[i]) === tileY) {
        ENT_A[i] = 0.0;
      }
    }
  }
}

function updateEditor(dt: number): void {
  // Camera pan with arrow keys
  const panSpeed = 400.0 / ED[EDI_ZOOM];
  if (isKeyDown(Key.LEFT) || isKeyDown(Key.A)) CAM[0] = CAM[0] - panSpeed * dt;
  if (isKeyDown(Key.RIGHT) || isKeyDown(Key.D)) CAM[0] = CAM[0] + panSpeed * dt;
  if (isKeyDown(Key.UP) || isKeyDown(Key.W)) CAM[1] = CAM[1] - panSpeed * dt;
  if (isKeyDown(Key.DOWN) || isKeyDown(Key.S)) CAM[1] = CAM[1] + panSpeed * dt;

  // Zoom
  if (isKeyPressed(Key.EQUAL)) ED[EDI_ZOOM] = clamp(ED[EDI_ZOOM] + 0.25, 0.25, 4.0);
  if (isKeyPressed(Key.MINUS)) ED[EDI_ZOOM] = clamp(ED[EDI_ZOOM] - 0.25, 0.25, 4.0);

  // Grid toggle
  if (isKeyPressed(Key.G)) ED[EDI_GRID] = ED[EDI_GRID] > 0.5 ? 0.0 : 1.0;

  // Undo/Redo (Ctrl+Z / Ctrl+Y)
  if (isKeyDown(Key.LEFT_CONTROL) || isKeyDown(Key.LEFT_SUPER)) {
    if (isKeyPressed(Key.Z)) doUndo();
    if (isKeyPressed(Key.Y)) doRedo();
    // Save shortcut
    if (isKeyPressed(Key.S)) {
      if (FNAME[0].length > 0) saveLevelToFile(FNAME[0]);
      else saveLevelToFile(findNextCustomName());
      playSound(sndSelect);
    }
  }
}

// ============================================================
// MAIN LOOP
// ============================================================

initNewLevel(60, 15);

const camera: Camera2D = {
  offset: { x: CANVAS_W * 0.5, y: TOOLBAR_H + CANVAS_H * 0.5 },
  target: { x: CAM[0], y: CAM[1] },
  rotation: 0.0,
  zoom: 1.0,
};

while (!windowShouldClose()) {
  const dt = getDeltaTime();
  const t = getTime();

  // Update
  if (ED[EDI_DLG] > 0.5) {
    updateOpenDialog();
  } else {
    updateEditor(dt);
    handleToolbarClicks();
    handlePaletteClicks();

    camera.target.x = floorf(CAM[0]);
    camera.target.y = floorf(CAM[1]);
    camera.zoom = ED[EDI_ZOOM];
    handleCanvasInput(camera);

    // Compute cursor tile position once per frame
    const curWorld = getScreenToWorld2D({ x: getMouseX(), y: getMouseY() }, camera);
    CURSOR_TILE[0] = floorf(curWorld.x / TILE_SIZE);
    CURSOR_TILE[1] = floorf(curWorld.y / TILE_SIZE);
  }

  // Draw
  beginDrawing();
  clearBackground(DARK_BG);

  // Canvas area background
  drawRect(0, TOOLBAR_H, CANVAS_W, CANVAS_H, CANVAS_BG);

  // World view
  beginMode2D(camera);

  // Level background
  drawRect(0, 0, floorf(ED[EDI_LW] * TILE_SIZE), floorf(ED[EDI_LH] * TILE_SIZE), LEVEL_BG);

  // Draw tiles (viewport culled)
  const w = floorf(ED[EDI_LW]);
  const h = floorf(ED[EDI_LH]);
  const zoom = ED[EDI_ZOOM];
  const vhw = (CANVAS_W * 0.5) / zoom + TILE_SIZE;
  const vhh = (CANVAS_H * 0.5) / zoom + TILE_SIZE;
  let sc = floorf((CAM[0] - vhw) / TILE_SIZE);
  let ec = floorf((CAM[0] + vhw) / TILE_SIZE) + 1;
  let sr = floorf((CAM[1] - vhh) / TILE_SIZE);
  let er = floorf((CAM[1] + vhh) / TILE_SIZE) + 1;
  if (sc < 0) sc = 0;
  if (sr < 0) sr = 0;
  if (ec >= w) ec = w - 1;
  if (er >= h) er = h - 1;

  for (let ty = sr; ty <= er; ty = ty + 1) {
    for (let tx = sc; tx <= ec; tx = tx + 1) {
      const tile = getTile(tx, ty);
      if (tile > T_AIR) {
        drawTileSprite(tile, tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw entities
  drawEntitiesInLevel();

  // Draw spawn marker
  drawSpawnMarker();

  // Grid
  drawGrid(camera);

  // Level border
  drawLevelBorder();

  // Cursor highlight
  if (getMouseX() < CANVAS_W && getMouseY() > TOOLBAR_H && getMouseY() < SCREEN_H - STATUS_H) {
    const world = getScreenToWorld2D({ x: getMouseX(), y: getMouseY() }, camera);
    const cursorTX = floorf(world.x / TILE_SIZE);
    const cursorTY = floorf(world.y / TILE_SIZE);
    if (cursorTX >= 0 && cursorTX < w && cursorTY >= 0 && cursorTY < h) {
      drawRectLines(cursorTX * TILE_SIZE, cursorTY * TILE_SIZE, TILE_SIZE, TILE_SIZE, 2, CURSOR_COLOR);
      // Preview selected item
      const mode = floorf(ED[EDI_MODE]);
      if (mode === MODE_TILE) {
        drawTileSprite(floorf(ED[EDI_TILE]), cursorTX * TILE_SIZE, cursorTY * TILE_SIZE, TILE_SIZE);
      } else if (mode === MODE_ENTITY) {
        drawEntityIcon(floorf(ED[EDI_ENT]), cursorTX * TILE_SIZE, cursorTY * TILE_SIZE, TILE_SIZE);
      }
    }
  }

  endMode2D();

  // UI overlays
  drawToolbar();
  drawPalette();
  drawStatusBar();

  // Open dialog
  if (ED[EDI_DLG] > 0.5) {
    drawOpenDialog();
  }

  endDrawing();
}

closeAudioDevice();
closeWindow();
