// Perry bug repro: arr[i] returns arr[0] in complex for-loop functions

import {
  initWindow, windowShouldClose, beginDrawing, endDrawing,
  clearBackground, setTargetFPS, getDeltaTime, getTime,
  isKeyPressed, isKeyDown,
  beginMode2D, endMode2D,
} from "bloom/core";
import { Color, Key, Camera2D } from "bloom/core";
import { drawRect, drawCircle, drawTriangle, drawLine, drawRectLines, checkCollisionRecs } from "bloom/shapes";
import { drawText, measureText } from "bloom/text";
import { loadTexture, drawTexturePro, setTextureFilter, FILTER_NEAREST, stageTextures, commitTexture } from "bloom/textures";
import { initAudioDevice, closeAudioDevice, loadSound, playSound } from "bloom/audio";
import { clamp, randomFloat, randomInt, lerp } from "bloom/math";
import { Rect, Texture, Sound } from "bloom/core";

const P = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const CAM = [400.0, 300.0, 1.0];
const GS = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const TILES: number[] = [];
const LVL = [0.0, 0.0, 0.0, 0.0];
const FLAG_POS = [0.0, 0.0, 0.0];
const EX: number[] = []; const EY: number[] = []; const EVX: number[] = []; const EVY: number[] = [];
const ET: number[] = []; const EA: number[] = []; const ES: number[] = []; const EHP: number[] = [];
const CX: number[] = []; const CY: number[] = []; const CA: number[] = []; const CT: number[] = [];
const PRX: number[] = []; const PRY: number[] = []; const PRVY: number[] = [];
const PRL: number[] = []; const PRM: number[] = []; const PRC: number[] = []; const PRS: number[] = [];
const PARSE_RESULT = [0.0, 0.0];
const TILE_PARSE_IDX = [0.0];
const TILE_SRC = 16;
const TILE_SIZE = 32;

for (let i = 0; i < 30; i = i + 1) {
  EX.push(0.0); EY.push(0.0); EVX.push(0.0); EVY.push(0.0);
  ET.push(0.0); EA.push(0.0); ES.push(0.0); EHP.push(0.0);
}
for (let i = 0; i < 100; i = i + 1) {
  CX.push(0.0); CY.push(0.0); CA.push(0.0); CT.push(0.0);
}
for (let i = 0; i < 200; i = i + 1) {
  PRX.push(0.0); PRY.push(0.0); PRVY.push(0.0);
  PRL.push(0.0); PRM.push(0.0); PRC.push(0.0); PRS.push(0.0);
}

CA[0] = 1.0; CT[0] = 10.0; CX[0] = 100.0; CY[0] = 200.0;
CA[5] = 1.0; CT[5] = 11.0; CX[5] = 300.0; CY[5] = 200.0;
CA[15] = 1.0; CT[15] = 20.0; CX[15] = 500.0; CY[15] = 200.0;

function floorf(a: number): number { return Math.floor(a); }

initWindow(800, 600, "Bug Repro");
setTargetFPS(60);
initAudioDevice();

const texTileset = loadTexture("assets/sprites/tileset.png");
setTextureFilter(texTileset, FILTER_NEAREST);
const texItems = loadTexture("assets/sprites/items.png");
setTextureFilter(texItems, FILTER_NEAREST);

const WHITE: Color = { r: 255, g: 255, b: 255, a: 255 };

function drawItemSprite(frame: number, x: number, y: number): void {
  drawTexturePro(texItems,
    { x: frame * TILE_SRC, y: 0.0, width: TILE_SRC, height: TILE_SRC },
    { x: x, y: y, width: TILE_SIZE, height: TILE_SIZE },
    { x: 0.0, y: 0.0 }, 0.0, WHITE);
}

// Matches the game's drawCollectibles exactly
function drawCollectibles(t: number): void {
  for (let i = 0; i < 100; i = i + 1) {
    if (CA[i] < 0.5) continue;
    const type = CT[i];

    if (type > 9.5 && type < 10.5) {
      const frame = floorf(t * 6.0) % 4;
      drawItemSprite(frame, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 10.5 && type < 11.5) {
      drawItemSprite(4, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 11.5 && type < 12.5) {
      drawItemSprite(5, floorf(CX[i]), floorf(CY[i]));
    } else if (type > 19.5) {
      const fx = floorf(CX[i]);
      const fy = floorf(CY[i]);
      drawRect(fx - 8, fy - 128, 48, 160, { r: 50, g: 255, b: 50, a: 60 });
      drawRect(fx + 14, fy - 120, 5, 152, { r: 160, g: 160, b: 170, a: 255 });
      drawRect(fx + 19, fy - 116, 32, 24, { r: 230, g: 40, b: 40, a: 255 });
      const wave = Math.sin(t * 4.0) * 4.0;
      drawTriangle(fx + 51, fy - 116, fx + 51, fy - 92, fx + 60 + floorf(wave), fy - 104, { r: 210, g: 30, b: 30, a: 255 });
      drawCircle(fx + 16, fy - 124, 6, { r: 255, g: 220, b: 50, a: 255 });
      drawText("GOAL", fx - 2, fy - 148, 18, { r: 255, g: 255, b: 50, a: 255 });
    }
  }
}

const camera: Camera2D = {
  offset: { x: 400.0, y: 300.0 },
  target: { x: 400.0, y: 300.0 },
  rotation: 0.0,
  zoom: 1.0,
};

let logged = 0.0;

while (!windowShouldClose()) {
  const t = getTime();
  beginDrawing();
  clearBackground({ r: 100, g: 180, b: 255, a: 255 });

  beginMode2D(camera);
  drawCollectibles(t);
  // Reference: green rect at flag position
  drawRect(500.0, 160.0, 10, 10, { r: 0, g: 255, b: 0, a: 255 });
  endMode2D();

  drawText("Green=flag ref at 500. Yellow=coin. Red banner=flag from loop", 10, 10, 16, WHITE);

  if (logged < 1.0) {
    // Check what drawCollectibles would see
    let cnt = 0.0;
    for (let i = 0; i < 100; i = i + 1) {
      if (CA[i] > 0.5) {
        console.log("main i=" + i.toString() + " CT=" + CT[i].toString() + " CX=" + CX[i].toString());
        cnt = cnt + 1.0;
      }
    }
    console.log("count=" + cnt.toString());
    logged = 1.0;
  }

  endDrawing();
}
closeAudioDevice();
