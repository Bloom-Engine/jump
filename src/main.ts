// ============================================================
// BLOOM JUMP — A Classic 2D Platformer
// Built with Bloom Engine, compiled by Perry
// ============================================================

import {
  initWindow, windowShouldClose, beginDrawing, endDrawing, runGame,
  clearBackground, setTargetFPS, setDirect2DMode, getDeltaTime, getTime,
  isKeyPressed, isKeyDown, isKeyReleased,
  getMouseX, getMouseY, isMouseButtonPressed,
  getScreenWidth, getScreenHeight, closeWindow, toggleFullscreen,
  beginMode2DRaw, endMode2D, getScreenToWorld2D,
  writeFile, readFile, fileExists,
  isMobile, isTV, isWatch, getPlatform, getLanguage, getCrownRotation,
  getTouchX, getTouchY, getTouchCount,
  isGamepadAvailable, getGamepadAxis, isGamepadButtonPressed, isGamepadButtonDown,
} from "@bloomengine/engine/core";
import { Color, Key, MouseButton } from "@bloomengine/engine/core";

// Perry's web target does not resolve imported const-object property access
// (`K_ENTER` returns undefined at runtime). Inlining the Key values locally
// keeps the game working on web; they stay in sync with engine/src/core/keys.ts.
const K_A = 65, K_D = 68, K_Q = 81, K_S = 83, K_W = 87;
const K_SPACE = 32, K_ENTER = 265, K_ESCAPE = 27;
const K_UP = 256, K_DOWN = 257, K_LEFT = 258, K_RIGHT = 259;
const K_F11 = 122;
const MB_LEFT = 0; // MouseButton.LEFT — inlined for web-target safety
import {
  drawRect, drawCircle, drawTriangle, drawLine, drawRectLines,
} from "@bloomengine/engine/shapes";
import { drawTextRgba, measureText } from "@bloomengine/engine/text";
import { FILTER_NEAREST } from "@bloomengine/engine/textures";
import {
  initAudioDevice, closeAudioDevice,
  loadSound, playSound, setSoundVolume,
  loadMusicRaw, playMusicRaw, stopMusicRaw, updateMusicStreamRaw, setMusicVolumeRaw,
} from "@bloomengine/engine/audio";
import { clamp, randomFloat, randomInt, lerp } from "@bloomengine/engine/math";
import { Texture, Sound } from "@bloomengine/engine/core";

// Direct FFI declaration — bypasses TypeScript wrapper object creation/property access overhead.
// Each drawTexturePro via the wrapper creates 4 objects + 16 property lookups.
// Direct call: zero objects, zero lookups, single FFI call.
declare function bloom_draw_texture_pro(
  handle: number, sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
  ox: number, oy: number, rot: number,
  r: number, g: number, b: number, a: number
): void;
declare function bloom_load_texture(path: number): number;
declare function bloom_set_texture_filter(handle: number, mode: number): void;
declare function bloom_draw_rect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_rect_lines(x: number, y: number, w: number, h: number, thickness: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_circle(cx: number, cy: number, radius: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_line(x1: number, y1: number, x2: number, y2: number, thickness: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, r: number, g: number, b: number, a: number): void;
declare function bloom_draw_text(text: number, x: number, y: number, size: number, r: number, g: number, b: number, a: number): void;
declare function bloom_load_font(path: number, size: number): number;
declare function bloom_draw_text_ex(font: number, text: number, x: number, y: number, size: number, spacing: number, r: number, g: number, b: number, a: number): void;
declare function bloom_measure_text_ex(font: number, text: number, size: number, spacing: number): number;

// ============================================================
// PLATFORM DETECTION
// ============================================================

// Platform detection — Perry-safe numeric checks
// Platform: 0=unknown, 1=macos, 2=ios, 3=windows, 4=linux, 5=android, 6=tvos, 7=web, 8=watchos, 9=visionos
const PLATF = [0.0, 0.0, 0.0, 0.0, 0.0]; // [platform, isMobile, isTV, isWatch, isVision]
PLATF[0] = getPlatform();
if (PLATF[0] > 1.5 && PLATF[0] < 2.5) PLATF[1] = 1.0;  // iOS
if (PLATF[0] > 4.5 && PLATF[0] < 5.5) PLATF[1] = 1.0;  // Android
if (PLATF[0] > 5.5 && PLATF[0] < 6.5) PLATF[2] = 1.0;  // tvOS
if (PLATF[0] > 7.5 && PLATF[0] < 8.5) PLATF[3] = 1.0;  // watchOS
// visionOS: the game runs in a flat window in the Shared Space. An eye+pinch is
// delivered to the window as a UITouch at the gaze location, so we reuse the
// mobile touch controls (virtual joystick to steer, pinch to jump) — pinch-drag
// the stick, pinch the right side to jump (two-handed on device). The gamepad
// path (GP[]) is polled every frame too, so a paired Bluetooth controller also
// works. VISION marks the platform for the forgiving pinch-jump zone below.
if (PLATF[0] > 8.5 && PLATF[0] < 9.5) { PLATF[1] = 1.0; PLATF[4] = 1.0; }  // visionOS → pinch/touch controls
// Store-screenshot capture: force the mobile UI (touch controls + mobile layout)
// regardless of host platform. Off in the shipping build; flipped on by
// store/tools/build_capture.sh --mobile. Rendering is identical to a real device
// (same code path) — only platform detection differs.
const CAPTURE_MOBILE = false;
if (CAPTURE_MOBILE) { PLATF[1] = 1.0; PLATF[2] = 0.0; PLATF[3] = 0.0; PLATF[4] = 0.0; }
const MOBILE = PLATF[1];
const TV = PLATF[2];
const WATCH = PLATF[3];
const VISION = PLATF[4];

// ============================================================
// I18N — auto-generated translation table (13 languages).
// Language index from getLanguage(); see pickLanguage(). CJK/Thai
// (ja/ko/th/zh) fall back to English until the Unicode font ships
// (CJK_FONT_READY). Edit tools/gen_i18n.py to regenerate.
// ============================================================
const CJK_FONT_READY = true; // set true once assets/fonts CJK+Thai font is bundled
function pickLanguage(): number {
  const v = getLanguage();
  if (v === 25966.0) return 0; // en
  if (v === 25701.0) return 1; // de
  if (v === 25971.0) return 2; // es
  if (v === 26226.0) return 3; // fr
  if (v === 26996.0) return 4; // it
  if (v === 27233.0) return CJK_FONT_READY ? 5 : 0; // ja
  if (v === 27503.0) return CJK_FONT_READY ? 6 : 0; // ko
  if (v === 28788.0) return 7; // pt
  if (v === 29800.0) return CJK_FONT_READY ? 8 : 0; // th
  if (v === 29810.0) return 9; // tr
  if (v === 30313.0) return 10; // vi
  if (v === 26980.0) return 11; // id
  if (v === 31336.0) return CJK_FONT_READY ? 12 : 0; // zh
  return 0; // default English
}
const LANG = pickLanguage();
// CJK/Thai font state: [fontHandle, useFlag]. Loaded after initWindow.
const I18N = [0.0, 0.0];
function L(a: string[]): string { return a[LANG]; }

const TR_LOADING: string[] = ["Loading...", "Lädt...", "Cargando...", "Chargement...", "Caricamento...", "読み込み中...", "불러오는 중...", "Carregando...", "กำลังโหลด...", "Yükleniyor...", "Đang tải...", "Memuat...", "加载中..."];
const TR_SUBTITLE: string[] = ["A Bloom Engine Platformer", "Ein Bloom Engine Jump-'n'-Run", "Un plataformas de Bloom Engine", "Un jeu de plateforme Bloom Engine", "Un platform di Bloom Engine", "Bloom Engine プラットフォーマー", "Bloom Engine 플랫포머", "Um plataforma da Bloom Engine", "เกมแพลตฟอร์ม Bloom Engine", "Bir Bloom Engine platform oyunu", "Game nền tảng Bloom Engine", "Platformer Bloom Engine", "Bloom Engine 平台游戏"];
const TR_PLAY: string[] = ["Play Game", "Spielen", "Jugar", "Jouer", "Gioca", "ゲーム開始", "게임 시작", "Jogar", "เริ่มเกม", "Oyna", "Chơi", "Main", "开始游戏"];
const TR_INFO: string[] = ["Info", "Info", "Información", "Infos", "Info", "情報", "정보", "Info", "ข้อมูล", "Bilgi", "Thông tin", "Info", "信息"];
const TR_HINT_KB: string[] = ["Arrow Keys / WASD to move, SPACE to jump", "Pfeiltasten / WASD bewegen, LEERTASTE springen", "Flechas / WASD mover, ESPACIO saltar", "Flèches / WASD pour bouger, ESPACE pour sauter", "Frecce / WASD muovi, SPAZIO salta", "矢印 / WASD で移動、スペースでジャンプ", "화살표 / WASD 이동, 스페이스 점프", "Setas / WASD mover, ESPAÇO pular", "ลูกศร / WASD เคลื่อนที่, เว้นวรรค กระโดด", "Yön tuşları / WASD hareket, BOŞLUK zıpla", "Phím mũi tên / WASD di chuyển, SPACE nhảy", "Panah / WASD bergerak, SPASI lompat", "方向键 / WASD 移动，空格跳跃"];
const TR_HINT_TOUCH_PLAY: string[] = ["Tap Play to begin", "Zum Starten tippen", "Toca Jugar para empezar", "Touchez Jouer pour commencer", "Tocca Gioca per iniziare", "タップして開始", "탭하여 시작", "Toque em Jogar para começar", "แตะเล่นเพื่อเริ่ม", "Başlamak için dokun", "Chạm Chơi để bắt đầu", "Ketuk Main untuk mulai", "点击开始"];
const TR_HINT_TV_SELECT: string[] = ["Press A to select", "A drücken zum Auswählen", "Pulsa A para seleccionar", "Appuyez sur A pour sélectionner", "Premi A per selezionare", "A で選択", "A로 선택", "Pressione A para selecionar", "กด A เพื่อเลือก", "Seçmek için A'ya bas", "Nhấn A để chọn", "Tekan A untuk pilih", "按 A 选择"];
const TR_HINT_CROWN: string[] = ["Crown to move, tap to jump", "Krone bewegen, tippen springen", "Corona mover, toca saltar", "Couronne pour bouger, touchez pour sauter", "Corona muovi, tocca salta", "クラウンで移動、タップでジャンプ", "크라운 이동, 탭 점프", "Coroa mover, toque pular", "หมุนคราวน์เคลื่อนที่ แตะกระโดด", "Taç ile hareket, dokun zıpla", "Vương miện di chuyển, chạm nhảy", "Crown bergerak, ketuk lompat", "表冠移动，点击跳跃"];
const TR_SELECT_LEVEL: string[] = ["SELECT LEVEL", "LEVEL WÄHLEN", "ELEGIR NIVEL", "CHOISIR UN NIVEAU", "SCEGLI LIVELLO", "レベル選択", "레벨 선택", "ESCOLHER NÍVEL", "เลือกด่าน", "SEVİYE SEÇ", "CHỌN MÀN", "PILIH LEVEL", "选择关卡"];
const TR_BACK: string[] = ["< Back", "< Zurück", "< Atrás", "< Retour", "< Indietro", "< 戻る", "< 뒤로", "< Voltar", "< กลับ", "< Geri", "< Quay lại", "< Kembali", "< 返回"];
const TR_HINT_LS_KB: string[] = ["Click or ENTER to play, ESC / Back to return", "Klick oder ENTER spielen, ESC / Zurück", "Clic o ENTER jugar, ESC / Atrás", "Clic ou ENTRÉE jouer, ÉCHAP / Retour", "Clic o INVIO gioca, ESC / Indietro", "クリックかENTERで開始、ESCで戻る", "클릭/ENTER 시작, ESC 뒤로", "Clique ou ENTER jogar, ESC / Voltar", "คลิกหรือ ENTER เล่น, ESC กลับ", "Tıkla/ENTER oyna, ESC geri", "Nhấp/ENTER chơi, ESC quay lại", "Klik/ENTER main, ESC kembali", "点击或回车开始，ESC 返回"];
const TR_HINT_LS_TOUCH: string[] = ["Tap a level to play", "Level antippen zum Spielen", "Toca un nivel para jugar", "Touchez un niveau pour jouer", "Tocca un livello per giocare", "レベルをタップして開始", "레벨을 탭하여 시작", "Toque num nível para jogar", "แตะด่านเพื่อเล่น", "Oynamak için seviyeye dokun", "Chạm màn để chơi", "Ketuk level untuk main", "点击关卡开始"];
const TR_HINT_LS_CROWN: string[] = ["Crown to select, tap to play", "Krone wählen, tippen spielen", "Corona elegir, toca jugar", "Couronne pour choisir, touchez pour jouer", "Corona scegli, tocca gioca", "クラウンで選択、タップで開始", "크라운 선택, 탭 시작", "Coroa escolher, toque jogar", "หมุนคราวน์เลือก แตะเล่น", "Taç ile seç, dokun oyna", "Vương miện chọn, chạm chơi", "Crown pilih, ketuk main", "表冠选择，点击开始"];
const TR_HINT_LS_TV: string[] =["A to play, Menu to go back", "A spielen, Menü zurück", "A jugar, Menú atrás", "A jouer, Menu retour", "A gioca, Menu indietro", "A で開始、メニューで戻る", "A 시작, 메뉴 뒤로", "A jogar, Menu voltar", "A เล่น, เมนู กลับ", "A oyna, Menü geri", "A chơi, Menu quay lại", "A main, Menu kembali", "A 开始，菜单返回"];
const TR_NO_LEVELS1: string[] = ["No levels found", "Keine Level gefunden", "No se encontraron niveles", "Aucun niveau trouvé", "Nessun livello trovato", "レベルが見つかりません", "레벨을 찾을 수 없음", "Nenhum nível encontrado", "ไม่พบด่าน", "Seviye bulunamadı", "Không tìm thấy màn", "Tidak ada level", "未找到关卡"];
const TR_NO_LEVELS2: string[] = ["Run the editor to create levels!", "Erstelle Level im Editor!", "¡Usa el editor para crear niveles!", "Utilisez l'éditeur pour créer des niveaux !", "Usa l'editor per creare livelli!", "エディタでレベルを作成！", "에디터로 레벨을 만드세요!", "Use o editor para criar níveis!", "ใช้เอดิเตอร์สร้างด่าน!", "Seviye oluşturmak için editörü kullan!", "Dùng trình chỉnh sửa để tạo màn!", "Gunakan editor untuk membuat level!", "用编辑器创建关卡！"];
const TR_PAUSED: string[] = ["PAUSED", "PAUSE", "PAUSA", "PAUSE", "PAUSA", "一時停止", "일시정지", "PAUSA", "หยุดชั่วคราว", "DURAKLATILDI", "TẠM DỪNG", "JEDA", "已暂停"];
const TR_RESUME: string[] = ["Resume", "Weiter", "Continuar", "Reprendre", "Riprendi", "再開", "계속", "Continuar", "เล่นต่อ", "Devam", "Tiếp tục", "Lanjut", "继续"];
const TR_QUIT_MENU: string[] = ["Quit to Menu", "Zum Menü", "Salir al menú", "Quitter au menu", "Esci al menu", "メニューへ", "메뉴로 나가기", "Sair para o menu", "กลับเมนู", "Menüye dön", "Về menu", "Ke menu", "退出到菜单"];
const TR_HINT_PAUSE_KB: string[] = ["Click a button, or ESC to Resume / Q to Quit", "Knopf klicken, ESC weiter / Q beenden", "Clic, ESC continuar / Q salir", "Cliquez, ÉCHAP reprendre / Q quitter", "Clicca, ESC riprendi / Q esci", "クリック、ESCで再開 / Qで終了", "클릭, ESC 계속 / Q 종료", "Clique, ESC continuar / Q sair", "คลิก, ESC เล่นต่อ / Q ออก", "Tıkla, ESC devam / Q çık", "Nhấp, ESC tiếp / Q thoát", "Klik, ESC lanjut / Q keluar", "点击，ESC 继续 / Q 退出"];
const TR_HINT_PAUSE_TOUCH: string[] = ["Tap to Resume or Quit", "Tippen: Weiter oder Beenden", "Toca para continuar o salir", "Touchez pour reprendre ou quitter", "Tocca per riprendere o uscire", "タップで再開・終了", "탭하여 계속/종료", "Toque para continuar ou sair", "แตะเพื่อเล่นต่อหรือออก", "Devam/çıkış için dokun", "Chạm để tiếp/thoát", "Ketuk untuk lanjut/keluar", "点击继续或退出"];
const TR_HINT_PAUSE_TV: string[] = ["A to Resume, Menu to Quit", "A weiter, Menü beenden", "A continuar, Menú salir", "A reprendre, Menu quitter", "A riprendi, Menu esci", "A で再開、メニューで終了", "A 계속, 메뉴 종료", "A continuar, Menu sair", "A เล่นต่อ, เมนู ออก", "A devam, Menü çık", "A tiếp, Menu thoát", "A lanjut, Menu keluar", "A 继续，菜单退出"];
const TR_GAME_OVER: string[] = ["GAME OVER", "GAME OVER", "FIN DEL JUEGO", "PARTIE TERMINÉE", "GAME OVER", "ゲームオーバー", "게임 오버", "FIM DE JOGO", "เกมโอเวอร์", "OYUN BİTTİ", "HẾT LƯỢT", "GAME OVER", "游戏结束"];
const TR_COINS: string[] = ["Coins", "Münzen", "Monedas", "Pièces", "Monete", "コイン", "코인", "Moedas", "เหรียญ", "Para", "Xu", "Koin", "金币"];
const TR_GEMS: string[] = ["Gems", "Edelsteine", "Gemas", "Gemmes", "Gemme", "ジェム", "보석", "Gemas", "อัญมณี", "Mücevher", "Ngọc", "Permata", "宝石"];
const TR_LIVES: string[] = ["Lives", "Leben", "Vidas", "Vies", "Vite", "残機", "목숨", "Vidas", "ชีวิต", "Can", "Mạng", "Nyawa", "生命"];
const TR_HINT_CONT_TOUCH: string[] = ["Tap to continue", "Tippen zum Fortfahren", "Toca para continuar", "Touchez pour continuer", "Tocca per continuare", "タップで続行", "탭하여 계속", "Toque para continuar", "แตะเพื่อไปต่อ", "Devam için dokun", "Chạm để tiếp tục", "Ketuk untuk lanjut", "点击继续"];
const TR_HINT_CONT_TV: string[] = ["Press A to continue", "A drücken zum Fortfahren", "Pulsa A para continuar", "Appuyez sur A pour continuer", "Premi A per continuare", "A で続行", "A로 계속", "Pressione A para continuar", "กด A เพื่อไปต่อ", "Devam için A'ya bas", "Nhấn A để tiếp tục", "Tekan A untuk lanjut", "按 A 继续"];
const TR_HINT_CONT_KB: string[] = ["Press ENTER to continue", "ENTER drücken zum Fortfahren", "Pulsa ENTER para continuar", "Appuyez sur ENTRÉE pour continuer", "Premi INVIO per continuare", "ENTER で続行", "ENTER로 계속", "Pressione ENTER para continuar", "กด ENTER เพื่อไปต่อ", "Devam için ENTER'a bas", "Nhấn ENTER để tiếp tục", "Tekan ENTER untuk lanjut", "按回车继续"];
const TR_LEVEL_COMPLETE: string[] = ["LEVEL COMPLETE!", "LEVEL GESCHAFFT!", "¡NIVEL COMPLETADO!", "NIVEAU TERMINÉ !", "LIVELLO COMPLETATO!", "レベルクリア！", "레벨 완료!", "NÍVEL CONCLUÍDO!", "ผ่านด่าน!", "SEVİYE TAMAM!", "HOÀN THÀNH MÀN!", "LEVEL SELESAI!", "关卡完成！"];
const TR_LEVEL: string[] = ["Level", "Level", "Nivel", "Niveau", "Livello", "レベル", "레벨", "Nível", "ด่าน", "Seviye", "Màn", "Level", "关卡"];
const TR_CUSTOM: string[] = ["Custom", "Eigen", "Personalizado", "Perso", "Personalizzato", "カスタム", "커스텀", "Personalizado", "กำหนดเอง", "Özel", "Tùy chỉnh", "Kustom", "自定义"];
const TR_GOAL: string[] = ["GOAL", "ZIEL", "META", "BUT", "TRAGUARDO", "ゴール", "골", "META", "เป้าหมาย", "HEDEF", "ĐÍCH", "TUJUAN", "终点"];
const TR_JUMP: string[] = ["Jump", "Springen", "Saltar", "Sauter", "Salta", "ジャンプ", "점프", "Pular", "กระโดด", "Zıpla", "Nhảy", "Lompat", "跳"];


// Crown accumulator — smooths Digital Crown rotation into a [-1,1] horizontal
// axis value used by the player-movement code. Crown deltas are radians since
// last read; we scale, decay, and clamp.
const CROWN = [0.0, 0.0]; // [velocity ∈ [-1,1], menuAccum in radians]
const CROWN_SCALE = 6.0;  // radians/sec → axis sensitivity
const CROWN_DECAY = 0.80; // per-frame velocity decay when crown is still
const CROWN_MENU_STEP = 0.35; // rad of rotation per menu selection nudge

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
// On very large screens (iPad) the raw UI scale (shortDim/DESIGN_H ≈ 2.7–3.4)
// makes the on-screen controls oversized and pushes them far from the corners,
// since both their radius and their edge offsets scale with it. Cap the scale
// used for touch-control sizing + placement so they stay thumb-comfortable and
// corner-hugging on big displays; phones (scale ≲ 2.0) are unaffected. Tune if
// controls still feel large on the biggest iPads.
const TOUCH_CTRL_MAX_SCALE = 2.0;

// Gamepad state: [moveX, jump, pause, up, down, confirm, prevUp, prevDown]
// prevUp/prevDown hold last frame's up/down so menu navigation can edge-detect
// a d-pad/stick push (axis-derived up/down are continuous level states — without
// the edge check, holding a direction re-fires every frame: infinite-speed menu
// scroll + a machine-gun select sound). Buttons already use the engine's
// edge-triggered isGamepadButtonPressed, so only the axis directions need this.
const GP = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
const GP_MOVE_X = 0;
const GP_JUMP = 1;
const GP_PAUSE = 2;
const GP_UP = 3;
const GP_DOWN = 4;
const GP_CONFIRM = 5;
const GP_PREV_UP = 6;
const GP_PREV_DOWN = 7;
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
const GI_STATE = 0; const GI_LEVEL = 1; const GI_SEL = 2; const GI_LCOUNT = 3;
const GI_FLAG = 4; const GI_CTIMER = 5; const GI_DTIMER = 6;

// Level data
const TILES: number[] = [];
const LVL = [0.0, 0.0, 0.0, 0.0]; // [width, height, spawnX, spawnY]
const FLAG_POS = [0.0, 0.0, 0.0]; // [x_pixels, y_pixels, active]

// Flat rect storage for collision checks. Perry 0.5.x miscompiles numeric
// obj.field reads on aarch64 Android (PerryTS/perry#128), so
// checkCollisionRecs with Rect objects silently returns false there —
// breaking coin collection, enemy stomp, and hurt detection. Arrays
// indexed by constants dodge the codegen bug.
// Layout: [x, y, w, h]
const PRECT = [0.0, 0.0, PW, PH];
const ERECT = [0.0, 0.0, 0.0, 0.0];
const R_X = 0; const R_Y = 1; const R_W = 2; const R_H = 3;

function aabbOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

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

// Mobile-landscape capture uses a phone-aspect window (~19.5:9) so the touch
// controls and UI scale match a real device; otherwise the normal desktop window.
const CAP_W = CAPTURE_MOBILE ? 1392.0 : SCREEN_W;
const CAP_H = CAPTURE_MOBILE ? 642.0 : SCREEN_H;
initWindow(CAP_W, CAP_H, "Bloom Jump", false);
setTargetFPS(60);
// Pure-2D game — take the direct-to-swapchain path in the engine and
// skip the deferred 3D pipeline entirely. On Android Adreno 618 this is
// the difference between ~15 fps and 60 fps.
setDirect2DMode(true);
initAudioDevice();

// Load the CJK/Thai subset font when the active language needs it (built-in
// font has no glyphs for ja/ko/zh/th). Raw handle avoids the Perry aarch64
// obj.field NaN bug. Latin glyphs are included so numbers/title still render.
if (LANG === 5) I18N[0] = bloom_load_font("assets/fonts/bloom_ja.ttf" as any, 64.0);
else if (LANG === 6) I18N[0] = bloom_load_font("assets/fonts/bloom_ko.ttf" as any, 64.0);
else if (LANG === 8) I18N[0] = bloom_load_font("assets/fonts/bloom_th.ttf" as any, 64.0);
else if (LANG === 12) I18N[0] = bloom_load_font("assets/fonts/bloom_zh.ttf" as any, 64.0);
if (I18N[0] !== 0.0) I18N[1] = 1.0;


// Show loading screen
beginDrawing();
clearBackground(LOADING_BG);
dtext(L(TR_LOADING), getScreenWidth() / 2 - 60, getScreenHeight() / 2 - 10, 24, 200, 200, 220, 255);
endDrawing();

// Load single atlas texture (all sprites in one sheet = zero texture switches).
// Bypass the Texture wrapper: on aarch64 Android, Perry miscompiles obj.field
// reads — `loadTexture(...).id` gives NaN and every subsequent draw is skipped.
// Calling bloom_load_texture directly keeps ATLAS_ID as a raw number.
const ATLAS_ID = bloom_load_texture("assets/sprites/atlas.png" as any);
bloom_set_texture_filter(ATLAS_ID, FILTER_NEAREST);
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
const musMenu = loadMusicRaw("assets/sounds/music_menu.ogg");
const musGame = loadMusicRaw("assets/sounds/music_game.ogg");
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

// Text routing: CJK/Thai languages render through the bundled subset font
// (drawTextEx); everything else uses the built-in font (drawTextRgba).
function dtext(text: string, x: number, y: number, size: number, r: number, g: number, b: number, a: number): void {
  if (I18N[1] > 0.5) bloom_draw_text_ex(I18N[0], text as any, x, y, size, 0.0, r, g, b, a);
  else drawTextRgba(text, x, y, size, r, g, b, a);
}
function mtext(text: string, size: number): number {
  if (I18N[1] > 0.5) return bloom_measure_text_ex(I18N[0], text as any, size, 0.0);
  return measureText(text, size);
}

// Axis-aligned point-in-rect test for desktop mouse / touch hit regions.
function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

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
    // Accumulate raw crown rotation for menu navigation. Reset during gameplay
    // so the accumulator can't snowball while the player is steering.
    const stNow = floorf(GS[GI_STATE]);
    if (stNow === floorf(ST_PLAYING)) {
      CROWN[1] = 0.0;
    } else {
      CROWN[1] = CROWN[1] + crownDelta;
    }
    if (getTouchCount() > 0.5) {
      TCH[TI_JUMP_DOWN] = 1.0;
    }
    if (TCH[TI_JUMP_DOWN] > 0.5 && TCH[TI_PREV_JUMP] < 0.5) {
      TCH[TI_JUMP_PRESSED] = 1.0;
    }
    return;
  }

  if (MOBILE < 0.5) return;

  // Cap the control scale on large screens (iPad) — see TOUCH_CTRL_MAX_SCALE.
  // Must match drawTouchControls so the hit regions line up with the visuals.
  let s = UI[UI_SCALE];
  if (s > TOUCH_CTRL_MAX_SCALE) s = TOUCH_CTRL_MAX_SCALE;
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

    // visionOS: gaze+pinch is imprecise, so a pinch anywhere on the right side
    // (outside the joystick zone, below the top-right pause corner) jumps —
    // you shouldn't have to land on the small jump button. The button still
    // renders as a hint and its hit-test above still works.
    if (VISION > 0.5 && tx >= sw * 0.4 && ty > sh * 0.22) {
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

// Returns +1 / -1 when the crown has been rotated far enough to nudge a menu,
// 0 otherwise. Consumes the accumulator on a step so each threshold crossing
// advances exactly once.
function consumeCrownStep(): number {
  if (CROWN[1] > CROWN_MENU_STEP) {
    CROWN[1] = 0.0;
    return 1.0;
  }
  if (CROWN[1] < 0.0 - CROWN_MENU_STEP) {
    CROWN[1] = 0.0;
    return 0.0 - 1.0;
  }
  return 0.0;
}

function updateGamepadInput(): void {
  // Snapshot last frame's up/down before recomputing, so menu code can detect
  // the rising edge of a d-pad/stick push (see GP_PREV_* note above).
  GP[GP_PREV_UP] = GP[GP_UP];
  GP[GP_PREV_DOWN] = GP[GP_DOWN];
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
    if (PRL[i] > 0.0) {
      PRX[i] = PRX[i] + PRVX[i] * dt;
      PRY[i] = PRY[i] + PRVY[i] * dt;
      PRVY[i] = PRVY[i] + 400.0 * dt;
      PRL[i] = PRL[i] - dt;
    }
  }
}

function drawParticles(): void {
  for (let i = 0; i < MAX_PARTICLES; i = i + 1) {
    if (PRL[i] > 0.0) {
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
  if (index < 0 || index >= GS[GI_LCOUNT]) return;
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

// Discover level files. Use `.push()` rather than `arr[i] = ...`: Perry's
// native codegen drops index assignments into module-level arrays that were
// declared empty (`const A: T[] = []`) — both the value and `.length` writes
// vanish, even when read back from inside the same function. Pre-initialized
// arrays (`const P = [0.0, 0.0, ...]`) don't have this problem.
function discoverLevels(): void {
  // Idempotent — keep the cached list once populated. Re-entry on each
  // menu→Play click would otherwise grow the list because the .length=0
  // clear pattern is also broken (see comment above).
  if (LEVEL_FILES.length > 0) { GS[GI_LCOUNT] = LEVEL_FILES.length; return; }
  // Stop after 2 consecutive misses rather than probing the full range. On web
  // `readFile` is a synchronous, main-thread XHR (see bloom_ffi.js) and every
  // miss is a blocking 404 before the first frame paints; the old fixed scan
  // fired 30 requests (25 of them 404s for level6-10 + custom_1-20). Levels and
  // editor-created customs are contiguous, so a 2-miss tolerance keeps a single
  // gap working while cutting the probe count dramatically.
  let levelMisses = 0;
  for (let i = 1; i <= 10 && levelMisses < 2; i = i + 1) {
    const path = "assets/levels/level" + i.toString() + ".txt";
    const data = readFile(path);
    if (data.length > 0) {
      LEVEL_FILES.push(path);
      LEVEL_NAMES.push((L(TR_LEVEL) + " ") + i.toString());
      levelMisses = 0;
    } else {
      levelMisses = levelMisses + 1;
    }
  }
  let customMisses = 0;
  for (let i = 1; i <= 20 && customMisses < 2; i = i + 1) {
    const path = "assets/levels/custom_" + i.toString() + ".txt";
    const data = readFile(path);
    if (data.length > 0) {
      LEVEL_FILES.push(path);
      LEVEL_NAMES.push((L(TR_CUSTOM) + " ") + i.toString());
      customMisses = 0;
    } else {
      customMisses = customMisses + 1;
    }
  }
  GS[GI_LCOUNT] = LEVEL_FILES.length;
}

// ============================================================
// PLAYER PHYSICS & COLLISION
// ============================================================

function playerTileCollisionX(): void {
  // Clamp to level horizontal bounds so player can't walk off-screen
  const levelRight = LVL[0] * TILE_SIZE;
  if (P[PI_X] + POX < 0.0) {
    P[PI_X] = 0.0 - POX;
    if (P[PI_VX] < 0.0) P[PI_VX] = 0.0;
  } else if (P[PI_X] + POX + PW > levelRight) {
    P[PI_X] = levelRight - PW - POX;
    if (P[PI_VX] > 0.0) P[PI_VX] = 0.0;
  }

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
  if (isKeyDown(K_LEFT) || isKeyDown(K_A)) moveDir = moveDir - 1.0;
  if (isKeyDown(K_RIGHT) || isKeyDown(K_D)) moveDir = moveDir + 1.0;
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
  if (isKeyPressed(K_SPACE) || isKeyPressed(K_UP) || isKeyPressed(K_W)) {
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
  if (isKeyDown(K_SPACE) || isKeyDown(K_UP) || isKeyDown(K_W)) jumpHeld = 1.0;
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

  // Perry web-target bug (issue #135 incompletely fixed in 0.5.161): `continue`
  // following a multi-branch if/else chain in a for loop jumps to the loop header
  // without running the increment, pinning i and hanging. Workaround: wrap the
  // body in `if (active) { ... }` and avoid `continue` entirely.
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] >= 0.5) {
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

    // Player collision with enemy (skip if player dead/invincible, inline the guard)
    if (P[PI_DEAD] < 0.5 && P[PI_INV] <= 0.0) {
      PRECT[R_X] = P[PI_X] + POX; PRECT[R_Y] = P[PI_Y] + POY;
      ERECT[R_X] = EX[i] + 4.0; ERECT[R_Y] = EY[i] + 4.0; ERECT[R_W] = TILE_SIZE - 8.0; ERECT[R_H] = TILE_SIZE - 8.0;

      if (aabbOverlap(PRECT[R_X], PRECT[R_Y], PRECT[R_W], PRECT[R_H], ERECT[R_X], ERECT[R_Y], ERECT[R_W], ERECT[R_H])) {
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
    } // end if (EA[i] >= 0.5)
  }
}

function drawEnemies(t: number): void {
  for (let i = 0; i < MAX_ENEMIES; i = i + 1) {
    if (EA[i] >= 0.5) {
      const frame = floorf(EHP[i]) % 2;
      const facingR = ES[i] > 0.5 ? 1.0 : 0.0;
      drawEnemySprite(floorf(ET[i]), frame, floorf(EX[i]), floorf(EY[i]), facingR);
    }
  }
}

// ============================================================
// COLLECTIBLES
// ============================================================

function updateCollectibles(dt: number, t: number): void {
  if (P[PI_DEAD] > 0.5 || GS[GI_FLAG] > 0.5) return;

  PRECT[R_X] = P[PI_X] + POX; PRECT[R_Y] = P[PI_Y] + POY;

  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] >= 0.5) {
      const type = CT[i];

      ERECT[R_X] = CX[i] + 6.0; ERECT[R_Y] = CY[i] + 6.0; ERECT[R_W] = 20.0; ERECT[R_H] = 20.0;

      if (aabbOverlap(PRECT[R_X], PRECT[R_Y], PRECT[R_W], PRECT[R_H], ERECT[R_X], ERECT[R_Y], ERECT[R_W], ERECT[R_H])) {
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
}

function drawCollectibles(t: number): void {
  for (let i = 0; i < MAX_COINS; i = i + 1) {
    if (CA[i] >= 0.5) {
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
        bloom_draw_rect(fx - 8, fy - 128, 48, 160, 50, 255, 50, 60);
        bloom_draw_rect(fx + 14, fy - 120, 5, 152, 160, 160, 170, 255);
        bloom_draw_rect(fx + 19, fy - 116, 32, 24, 230, 40, 40, 255);
        const wave = Math.sin(t * 4.0) * 4.0;
        bloom_draw_triangle(fx + 51, fy - 116, fx + 51, fy - 92, fx + 60 + floorf(wave), fy - 104, 210, 30, 30, 255);
        bloom_draw_circle(fx + 16, fy - 124, 6, 255, 220, 50, 255);
        dtext(L(TR_GOAL), fx - 2, fy - 148, 18, 255, 255, 50, 255);
      }
    }
  }
}

// ============================================================
// CAMERA
// ============================================================

function updateCamera(dt: number, sw: number, sh: number): void {
  // Set zoom to UI scale so game world fills the screen proportionally.
  // On the watch the UI scale (~0.33) zooms the world out so far the player
  // is a speck against mostly sky — pick a zoom that frames ~7 tiles across
  // so the character and nearby ground fill the tiny screen.
  if (WATCH > 0.5) {
    CAM[2] = sw / (7.0 * TILE_SIZE);
  } else {
    CAM[2] = UI[UI_SCALE];
  }

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
  dtext("x" + floorf(P[PI_COINS]).toString(), floorf(158.0 * s), floorf(16.0 * s), textSize, 255, 255, 255, 255);

  // Gem count
  if (P[PI_GEMS] > 0.0) {
    drawItemSprite(4, floorf(220.0 * s), margin);
    dtext("x" + floorf(P[PI_GEMS]).toString(), floorf(254.0 * s), floorf(16.0 * s), textSize, 255, 255, 255, 255);
  }

  // Lives
  const livesSize = floorf(20.0 * s);
  dtext((L(TR_LIVES) + ": ") + floorf(P[PI_LIVES]).toString(), sw - floorf(120.0 * s), floorf(16.0 * s), livesSize, 255, 255, 255, 255);
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
  const titleW = mtext(titleText, titleSize);
  dtext(titleText, floorf((sw - titleW) / 2.0), floorf(120.0 * s), titleSize, 255, 255, 255, 255);

  // Subtitle
  const subSize = floorf(20.0 * s);
  const subText = L(TR_SUBTITLE);
  const subW = mtext(subText, subSize);
  dtext(subText, floorf((sw - subW) / 2.0), floorf(190.0 * s), subSize, 220, 220, 255, 255);

  // Menu options
  const menuCount = 2;
  const menuSize = floorf(30.0 * s);
  const options = [L(TR_PLAY), L(TR_INFO)];
  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < menuCount; i = i + 1) {
    const label = options[i];
    const oy = floorf((300.0 + i * 50.0) * s);
    const ow = mtext(label, menuSize);
    const ox = floorf((sw - ow) / 2.0);
    if (i === selIdx) {
      const pulse = Math.sin(t * 4.0) * 0.3 + 0.7;
      const alpha = floorf(255.0 * pulse);
      dtext("> " + label + " <", floorf(ox - 30.0 * s), oy, menuSize, 255, 255, 100, alpha);
    } else {
      dtext(label, ox, oy, menuSize, 200, 200, 220, 200);
    }
  }

  // Instructions
  const instrSize = floorf(16.0 * s);
  if (WATCH > 0.5) {
    const iw = mtext(L(TR_HINT_CROWN), instrSize);
    dtext(L(TR_HINT_CROWN), floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  } else if (MOBILE > 0.5) {
    const iw = mtext(L(TR_HINT_TOUCH_PLAY), instrSize);
    dtext(L(TR_HINT_TOUCH_PLAY), floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = mtext(L(TR_HINT_TV_SELECT), instrSize);
    dtext(L(TR_HINT_TV_SELECT), floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = mtext(L(TR_HINT_KB), instrSize);
    dtext(L(TR_HINT_KB), floorf((sw - iw) / 2.0), floorf(sh - 60.0 * s), instrSize, 180, 180, 200, 180);
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
  const menuMax = 1.0;
  // Keyboard / gamepad navigation. Gamepad up/down are edge-detected (push, not
  // hold) so a held d-pad/stick advances one item per press, matching the
  // edge-triggered keyboard keys — see GP_PREV_* note.
  if (isKeyPressed(K_DOWN) || isKeyPressed(K_S) || (GP[GP_DOWN] > 0.5 && GP[GP_PREV_DOWN] < 0.5)) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] > menuMax) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(K_UP) || isKeyPressed(K_W) || (GP[GP_UP] > 0.5 && GP[GP_PREV_UP] < 0.5)) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = menuMax;
    playSound(sndSelect);
  }
  if (isKeyPressed(265) || isKeyPressed(32) || GP[GP_CONFIRM] > 0.5) {
    selectMenuItem(sw, sh);
  }
  // Watch: crown scrolls the selection, a tap on the face confirms.
  if (WATCH > 0.5) {
    const step = consumeCrownStep();
    if (step > 0.5) {
      GS[GI_SEL] = GS[GI_SEL] + 1.0;
      if (GS[GI_SEL] > menuMax) GS[GI_SEL] = 0.0;
      playSound(sndSelect);
    } else if (step < 0.0 - 0.5) {
      GS[GI_SEL] = GS[GI_SEL] - 1.0;
      if (GS[GI_SEL] < 0.0) GS[GI_SEL] = menuMax;
      playSound(sndSelect);
    }
    if (TCH[TI_JUMP_PRESSED] > 0.5) {
      selectMenuItem(sw, sh);
    }
  }
  // Touch: tap on menu items
  if (MOBILE > 0.5) {
    const s = UI[UI_SCALE];
    const tc = getTouchCount();
    for (let ti = 0; ti < tc; ti = ti + 1) {
      const tx = getTouchX(ti);
      const ty = getTouchY(ti);
      if (tx > sw * 0.1 && tx < sw * 0.9) {
        for (let mi = 0; mi < 2; mi = mi + 1) {
          const itemY = floorf((300.0 + mi * 50.0) * s);
          if (ty > itemY - 10.0 && ty < itemY + floorf(40.0 * s)) {
            GS[GI_SEL] = mi;
            selectMenuItem(sw, sh);
          }
        }
      }
    }
  }
  // Desktop: mouse hover highlights a menu item, left-click selects it.
  // Regions match the menu layout in drawTitleScreen / the touch block above.
  if (MOBILE < 0.5 && TV < 0.5) {
    const s = UI[UI_SCALE];
    const mx = getMouseX();
    const my = getMouseY();
    for (let mi = 0; mi < 2; mi = mi + 1) {
      const itemY = floorf((300.0 + mi * 50.0) * s);
      if (mx > sw * 0.1 && mx < sw * 0.9 && my > itemY - 10.0 && my < itemY + floorf(40.0 * s)) {
        GS[GI_SEL] = mi;
        if (isMouseButtonPressed(MB_LEFT)) {
          selectMenuItem(sw, sh);
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
      const tw = mtext(text, fontSize);
      const tx = floorf((sw - tw) / 2.0);
      const ty = floorf(lineY);

      if (lineType < 1.5) {
        // Heading — bright gold
        dtext(text, tx, ty, fontSize, 255, 220, 80, a);
      } else if (lineType < 2.5) {
        // Subheading — soft cyan
        dtext(text, tx, ty, fontSize, 120, 220, 255, a);
      } else if (lineType < 3.5) {
        // Body — white
        dtext(text, tx, ty, fontSize, 255, 255, 255, a);
      } else {
        // Small — dim
        dtext(text, tx, ty, fontSize, 160, 160, 180, a);
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
  if (isKeyPressed(K_ESCAPE) || isKeyPressed(K_ENTER) || isKeyPressed(K_SPACE)) dismiss = 1.0;
  if (GP[GP_CONFIRM] > 0.5 || GP[GP_PAUSE] > 0.5) dismiss = 1.0;
  if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) dismiss = 1.0;
  if (MOBILE < 0.5 && TV < 0.5 && isMouseButtonPressed(MB_LEFT)) dismiss = 1.0;
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
  // Watch: smaller heading so it clears the system clock overlay (top-right).
  let titleSize = floorf(36.0 * s);
  if (WATCH > 0.5) titleSize = floorf(26.0 * s);
  const tw = mtext(L(TR_SELECT_LEVEL), titleSize);
  dtext(L(TR_SELECT_LEVEL), floorf((sw - tw) / 2.0), floorf(40.0 * s), titleSize, 255, 255, 255, 255);

  // Back button (top-left) — clickable on desktop, tappable on mobile.
  // Hover-highlight on desktop so it reads as a button. Hidden on watch,
  // where any tap confirms the highlighted level instead.
  if (WATCH < 0.5) {
    const backSize = floorf(22.0 * s);
    const backLabel = L(TR_BACK);
    const backW = mtext(backLabel, backSize);
    const backHover = pointInRect(getMouseX(), getMouseY(),
      floorf(16.0 * s), floorf(34.0 * s), backW + floorf(24.0 * s), floorf(34.0 * s)) && MOBILE < 0.5 && TV < 0.5;
    bloom_draw_rect(floorf(16.0 * s), floorf(34.0 * s), backW + floorf(24.0 * s), floorf(34.0 * s),
      255, 255, 255, backHover ? 60 : 30);
    dtext(backLabel, floorf(28.0 * s), floorf(40.0 * s), backSize,
      255, 255, 255, backHover ? 255 : 220);
  }

  const count = floorf(GS[GI_LCOUNT]);
  const itemSize = floorf(24.0 * s);
  const rowH = floorf(40.0 * s);
  if (count < 1) {
    const emptySize = floorf(20.0 * s);
    dtext(L(TR_NO_LEVELS1), floorf(150.0 * s), floorf(250.0 * s), emptySize, 200, 200, 200, 200);
    dtext(L(TR_NO_LEVELS2), floorf(170.0 * s), floorf(290.0 * s), emptySize, 200, 200, 200, 200);
  }

  const selIdx = floorf(GS[GI_SEL]);
  for (let i = 0; i < count; i = i + 1) {
    if (i >= LEVEL_NAMES.length) break;
    const name = LEVEL_NAMES[i];
    const oy = floorf((100.0 + i * 40.0) * s);
    if (oy > sh - floorf(80.0 * s)) break;

    if (i === selIdx) {
      bloom_draw_rect(floorf(80.0 * s), oy - floorf(4.0 * s), sw - floorf(160.0 * s), floorf(36.0 * s), 255, 255, 255, 30);
      dtext("> " + name, floorf(100.0 * s), oy, itemSize, 255, 255, 100, 255);
    } else {
      dtext(name, floorf(120.0 * s), oy, itemSize, 200, 200, 220, 200);
    }
  }

  const instrSize = floorf(18.0 * s);
  if (WATCH > 0.5) {
    const iw = mtext(L(TR_HINT_LS_CROWN), instrSize);
    dtext(L(TR_HINT_LS_CROWN), floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  } else if (MOBILE > 0.5) {
    const iw = mtext(L(TR_HINT_LS_TOUCH), instrSize);
    dtext(L(TR_HINT_LS_TOUCH), floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = mtext(L(TR_HINT_LS_TV), instrSize);
    dtext(L(TR_HINT_LS_TV), floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = mtext(L(TR_HINT_LS_KB), instrSize);
    dtext(L(TR_HINT_LS_KB), floorf((sw - iw) / 2.0), sh - floorf(40.0 * s), instrSize, 180, 180, 200, 180);
  }
}

function updateLevelSelect(sw: number, sh: number): void {
  const count = floorf(GS[GI_LCOUNT]);
  // Keyboard / gamepad navigation. Gamepad up/down are edge-detected (push, not
  // hold) so a held d-pad/stick advances one item per press — see GP_PREV_* note.
  if (isKeyPressed(K_DOWN) || isKeyPressed(K_S) || (GP[GP_DOWN] > 0.5 && GP[GP_PREV_DOWN] < 0.5)) {
    GS[GI_SEL] = GS[GI_SEL] + 1.0;
    if (GS[GI_SEL] >= count) GS[GI_SEL] = 0.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(K_UP) || isKeyPressed(K_W) || (GP[GP_UP] > 0.5 && GP[GP_PREV_UP] < 0.5)) {
    GS[GI_SEL] = GS[GI_SEL] - 1.0;
    if (GS[GI_SEL] < 0.0) GS[GI_SEL] = count - 1.0;
    playSound(sndSelect);
  }
  if (isKeyPressed(K_ENTER) || isKeyPressed(K_SPACE) || GP[GP_CONFIRM] > 0.5) {
    if (count > 0) {
      startLevel(floorf(GS[GI_SEL]));
      GS[GI_STATE] = ST_PLAYING;
      switchMusic(2.0);
      playSound(sndSelect);
    }
  }
  if (isKeyPressed(K_ESCAPE) || GP[GP_PAUSE] > 0.5) {
    GS[GI_STATE] = ST_MENU;
    GS[GI_SEL] = 0.0;
  }
  // Desktop: mouse hover highlights a row, left-click plays it; the Back
  // button (top-left) returns to the menu.
  if (MOBILE < 0.5 && TV < 0.5) {
    const ms = UI[UI_SCALE];
    const mx = getMouseX();
    const my = getMouseY();
    const backW = mtext(L(TR_BACK), floorf(22.0 * ms));
    const overBack = pointInRect(mx, my, floorf(16.0 * ms), floorf(34.0 * ms), backW + floorf(24.0 * ms), floorf(34.0 * ms));
    if (overBack) {
      if (isMouseButtonPressed(MB_LEFT)) {
        GS[GI_STATE] = ST_MENU;
        GS[GI_SEL] = 0.0;
        playSound(sndSelect);
      }
    } else {
      for (let i = 0; i < count; i = i + 1) {
        if (i >= LEVEL_NAMES.length) break;
        const oy = floorf((100.0 + i * 40.0) * ms);
        if (oy > sh - floorf(80.0 * ms)) break;
        if (pointInRect(mx, my, floorf(80.0 * ms), oy - floorf(4.0 * ms), sw - floorf(160.0 * ms), floorf(36.0 * ms))) {
          GS[GI_SEL] = i;
          if (isMouseButtonPressed(MB_LEFT)) {
            startLevel(floorf(i));
            GS[GI_STATE] = ST_PLAYING;
            switchMusic(2.0);
            playSound(sndSelect);
          }
        }
      }
    }
  }
  // Watch: crown scrolls the level list, a tap confirms the highlight.
  if (WATCH > 0.5) {
    const step = consumeCrownStep();
    if (step > 0.5) {
      GS[GI_SEL] = GS[GI_SEL] + 1.0;
      if (GS[GI_SEL] >= count) GS[GI_SEL] = 0.0;
      playSound(sndSelect);
    } else if (step < 0.0 - 0.5) {
      GS[GI_SEL] = GS[GI_SEL] - 1.0;
      if (GS[GI_SEL] < 0.0) GS[GI_SEL] = count - 1.0;
      playSound(sndSelect);
    }
    if (TCH[TI_JUMP_PRESSED] > 0.5 && count > 0) {
      startLevel(floorf(GS[GI_SEL]));
      GS[GI_STATE] = ST_PLAYING;
      switchMusic(2.0);
      playSound(sndSelect);
    }
  }
  // Touch: tap the Back button or a level row
  if (MOBILE > 0.5) {
    const s = UI[UI_SCALE];
    const backW = mtext(L(TR_BACK), floorf(22.0 * s));
    const tc = getTouchCount();
    for (let ti = 0.0; ti < tc; ti = ti + 1.0) {
      const tx = getTouchX(ti);
      const ty = getTouchY(ti);
      if (pointInRect(tx, ty, floorf(16.0 * s), floorf(34.0 * s), backW + floorf(24.0 * s), floorf(34.0 * s))) {
        GS[GI_STATE] = ST_MENU;
        GS[GI_SEL] = 0.0;
        playSound(sndSelect);
      }
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
  const text = L(TR_PAUSED);
  const tw = mtext(text, pauseSize);
  dtext(text, floorf((sw - tw) / 2.0), floorf(220.0 * s), pauseSize, 255, 255, 255, 255);

  const btnSize = floorf(28.0 * s);
  const desktop = MOBILE < 0.5 && TV < 0.5;
  const mx = getMouseX();
  const my = getMouseY();
  const btnX = floorf(sw * 0.2);
  const btnW = floorf(sw * 0.6);

  // Resume button (hit region matches the click handler in the ST_PAUSED state)
  const resumeHover = desktop && pointInRect(mx, my, btnX, floorf(280.0 * s), btnW, floorf(40.0 * s));
  if (desktop) bloom_draw_rect(btnX, floorf(280.0 * s), btnW, floorf(40.0 * s), 255, 255, 255, resumeHover ? 55 : 22);
  const resumeLabel = L(TR_RESUME);
  const resumeW = mtext(resumeLabel, btnSize);
  dtext(resumeLabel, floorf((sw - resumeW) / 2.0), floorf(290.0 * s), btnSize, 230, 230, 245, resumeHover ? 255 : 210);

  // Quit button
  const quitHover = desktop && pointInRect(mx, my, btnX, floorf(330.0 * s), btnW, floorf(40.0 * s));
  if (desktop) bloom_draw_rect(btnX, floorf(330.0 * s), btnW, floorf(40.0 * s), 255, 255, 255, quitHover ? 55 : 22);
  const quitLabel = L(TR_QUIT_MENU);
  const quitW = mtext(quitLabel, btnSize);
  dtext(quitLabel, floorf((sw - quitW) / 2.0), floorf(340.0 * s), btnSize, 230, 230, 245, quitHover ? 255 : 210);

  const instrSize = floorf(16.0 * s);
  if (MOBILE > 0.5) {
    const iw = mtext(L(TR_HINT_PAUSE_TOUCH), instrSize);
    dtext(L(TR_HINT_PAUSE_TOUCH), floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  } else if (TV > 0.5) {
    const iw = mtext(L(TR_HINT_PAUSE_TV), instrSize);
    dtext(L(TR_HINT_PAUSE_TV), floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  } else {
    const iw = mtext(L(TR_HINT_PAUSE_KB), instrSize);
    dtext(L(TR_HINT_PAUSE_KB), floorf((sw - iw) / 2.0), floorf(400.0 * s), instrSize, 180, 180, 200, 180);
  }
}

function drawGameOver(sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  drawSkyGradient(sw, sh);
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 30, 120);
  const headSize = floorf(48.0 * s);
  const text = L(TR_GAME_OVER);
  const tw = mtext(text, headSize);
  dtext(text, floorf((sw - tw) / 2.0), floorf(200.0 * s), headSize, 230, 60, 60, 255);

  const bodySize = floorf(24.0 * s);
  const coinsText = (L(TR_COINS) + ": ") + floorf(P[PI_COINS]).toString();
  const cw = mtext(coinsText, bodySize);
  dtext(coinsText, floorf((sw - cw) / 2.0), floorf(280.0 * s), bodySize, 255, 255, 255, 255);

  const instrSize = floorf(20.0 * s);
  if (MOBILE > 0.5) {
    const iw = mtext(L(TR_HINT_CONT_TOUCH), instrSize);
    dtext(L(TR_HINT_CONT_TOUCH), floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, 200, 200, 220, 200);
  } else if (TV > 0.5) {
    const iw = mtext(L(TR_HINT_CONT_TV), instrSize);
    dtext(L(TR_HINT_CONT_TV), floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, 200, 200, 220, 200);
  } else {
    const iw = mtext(L(TR_HINT_CONT_KB), instrSize);
    dtext(L(TR_HINT_CONT_KB), floorf((sw - iw) / 2.0), floorf(360.0 * s), instrSize, 200, 200, 220, 200);
  }
}

function drawLevelCompleteScreen(t: number, sw: number, sh: number): void {
  const s = UI[UI_SCALE];
  bloom_draw_rect(0, 0, sw, sh, 0, 0, 0, 150);
  const headSize = floorf(42.0 * s);
  const text = L(TR_LEVEL_COMPLETE);
  const tw = mtext(text, headSize);
  dtext(text, floorf((sw - tw) / 2.0), floorf(180.0 * s), headSize, 255, 255, 100, 255);

  const bodySize = floorf(24.0 * s);
  const coinsText = (L(TR_COINS) + ": ") + floorf(P[PI_COINS]).toString();
  const cw = mtext(coinsText, bodySize);
  dtext(coinsText, floorf((sw - cw) / 2.0), floorf(260.0 * s), bodySize, 255, 255, 255, 255);

  if (P[PI_GEMS] > 0.0) {
    const gemText = (L(TR_GEMS) + ": ") + floorf(P[PI_GEMS]).toString();
    const gw = mtext(gemText, bodySize);
    dtext(gemText, floorf((sw - gw) / 2.0), floorf(300.0 * s), bodySize, 50, 150, 255, 255);
  }

  const instrSize = floorf(20.0 * s);
  if (MOBILE > 0.5) {
    const iw = mtext(L(TR_HINT_CONT_TOUCH), instrSize);
    dtext(L(TR_HINT_CONT_TOUCH), floorf((sw - iw) / 2.0), floorf(380.0 * s), instrSize, 200, 200, 220, 200);
  } else if (TV > 0.5) {
    const iw = mtext(L(TR_HINT_CONT_TV), instrSize);
    dtext(L(TR_HINT_CONT_TV), floorf((sw - iw) / 2.0), floorf(380.0 * s), instrSize, 200, 200, 220, 200);
  } else {
    dtext(L(TR_HINT_CONT_KB), floorf(sw / 2.0) - 120, 380, 20, 200, 200, 220, 200);
  }
}

// ============================================================
// TOUCH CONTROLS OVERLAY
// ============================================================

function drawTouchControls(sw: number, sh: number): void {
  if (MOBILE < 0.5) return;

  // Cap the control scale on large screens (iPad) — must match updateTouchInput.
  let s = UI[UI_SCALE];
  if (s > TOUCH_CTRL_MAX_SCALE) s = TOUCH_CTRL_MAX_SCALE;

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
  dtext(L(TR_JUMP), jumpX - floorf(20.0 * s), jumpY - floorf(8.0 * s), jumpLabelSize, 255, 255, 255, 150);

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

// Start at title screen
GS[GI_STATE] = ST_MENU;
switchMusic(1.0);

// runGame dispatches per platform: rAF-driven on web (bloom_run_game hook),
// blocking while-loop on native. The callback receives dt; beginDrawing/
// endDrawing are done by runGame itself, so we don't call them in here.
// ============================================================
// SCREENSHOT CAPTURE MODE (App Store / Play Store asset generation)
// Off in the shipping build. store/tools/build_capture.sh flips this to true and
// compiles a throwaway binary; store/tools/capture_window.py runs it once per
// language (language from -AppleLanguages) and grabs the window with macOS
// screencapture at the end of each hold. This controller only *navigates* —
// title → level select → gameplay → pause — on a wall-clock timer so the
// external driver can sync to each screen. (The engine's bloom_take_screenshot
// only writes from the deferred render path, so we don't rely on it here.)
// ============================================================
const CAPTURE_MODE = false;
const CAP = [0.0, -1.0]; // [phaseStartTime(sec), phase] — phase -1 = not started
const CAP_HOLD = 3.0;    // seconds to hold each screen before advancing
function captureStep(): void {
  const ct = getTime();
  if (CAP[1] < -0.5) { CAP[1] = 0.0; CAP[0] = ct; GS[GI_STATE] = ST_MENU; }
  if (ct - CAP[0] >= CAP_HOLD) {
    CAP[1] = CAP[1] + 1.0;
    CAP[0] = ct;
    const np = floorf(CAP[1]);
    if (np === 1.0) { discoverLevels(); GS[GI_STATE] = ST_LEVEL_SELECT; GS[GI_SEL] = 0.0; }
    else if (np === 2.0) { discoverLevels(); startLevel(0); GS[GI_STATE] = ST_PLAYING; }
    else if (np === 3.0) { GS[GI_STATE] = ST_PAUSED; }
    // np >= 4: stay on the pause screen; the driver captures, then kills us.
  }
}

runGame((dt: number): void => {
  const t = getTime();
  if (CAPTURE_MODE) captureStep();

  // Dynamic screen size (mobile fills device screen, desktop uses SCREEN_W/SCREEN_H)
  const sw = getScreenWidth();
  const sh = getScreenHeight();

  // UI scale: scale all text/positions relative to design height
  // In landscape sh is shorter dim, in portrait sw is shorter
  const shortDim = sw < sh ? sw : sh;
  UI[UI_SCALE] = shortDim / DESIGN_H;
  // Watch screens are physically tiny — boost all UI text so menus stay legible.
  if (WATCH > 0.5) UI[UI_SCALE] = UI[UI_SCALE] * 1.4;

  // Update music stream (must be called every frame)
  if (MUS[0] > 0.5 && MUS[0] < 1.5) updateMusicStreamRaw(musMenu);
  if (MUS[0] > 1.5 && MUS[0] < 2.5) updateMusicStreamRaw(musGame);

  // Process platform input
  updateTouchInput(sw, sh);
  updateGamepadInput();

  const state = floorf(GS[GI_STATE]);

  // Desktop-only: F11 toggles fullscreen (mobile/TV are already fullscreen).
  // Checked here, above the state machine, so it works in every screen.
  if (MOBILE < 0.5 && TV < 0.5 && isKeyPressed(K_F11)) toggleFullscreen();

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
    updatePlayer(dt);
    updateEnemies(dt);
    updateCollectibles(dt, t);
    updateParticles(dt);
    updateCamera(dt, sw, sh);

    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);

    beginMode2DRaw(sw * 0.5, sh * 0.5, floorf(CAM[0]), floorf(CAM[1]), 0.0, CAM[2]);
    drawVisibleTiles(sw, sh);
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    drawParticles();
    endMode2D();

    drawHUD(sw, sh);
    drawTouchControls(sw, sh);

    // Pause
    if (isKeyPressed(K_ESCAPE) || TCH[TI_PAUSE_PRESSED] > 0.5 || GP[GP_PAUSE] > 0.5) {
      GS[GI_STATE] = ST_PAUSED;
    }

  } else if (state === ST_PAUSED) {
    // === PAUSED ===
    // Draw game underneath
    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);
    beginMode2DRaw(sw * 0.5, sh * 0.5, floorf(CAM[0]), floorf(CAM[1]), 0.0, CAM[2]);
    drawVisibleTiles(sw, sh);
    drawCollectibles(t);
    drawEnemies(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD(sw, sh);
    drawPauseScreen(sw, sh);

    if (isKeyPressed(K_ESCAPE) || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_PLAYING;
    }
    if (isKeyPressed(K_Q) || GP[GP_PAUSE] > 0.5) {
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
    // Desktop: left-click Resume or Quit (regions match drawPauseScreen)
    if (MOBILE < 0.5 && TV < 0.5 && isMouseButtonPressed(MB_LEFT)) {
      const ps = UI[UI_SCALE];
      const mbx = floorf(sw * 0.2);
      const mbw = floorf(sw * 0.6);
      const mpx = getMouseX();
      const mpy = getMouseY();
      if (pointInRect(mpx, mpy, mbx, floorf(280.0 * ps), mbw, floorf(40.0 * ps))) {
        GS[GI_STATE] = ST_PLAYING;
      }
      if (pointInRect(mpx, mpy, mbx, floorf(330.0 * ps), mbw, floorf(40.0 * ps))) {
        GS[GI_STATE] = ST_MENU; GS[GI_SEL] = 0.0; switchMusic(1.0);
      }
    }

  } else if (state === ST_GAME_OVER) {
    // === GAME OVER ===
    drawGameOver(sw, sh);
    let goAnyTap = 0.0;
    if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) goAnyTap = 1.0;
    if (isKeyPressed(K_ENTER) || goAnyTap > 0.5 || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL];
      P[PI_LIVES] = 3.0;
      switchMusic(1.0);
    }

  } else if (state === ST_LEVEL_COMPLETE) {
    // === LEVEL COMPLETE ===
    // Draw game underneath
    drawSkyGradient(sw, sh);
    drawParallaxBg(sw, sh);
    beginMode2DRaw(sw * 0.5, sh * 0.5, floorf(CAM[0]), floorf(CAM[1]), 0.0, CAM[2]);
    drawVisibleTiles(sw, sh);
    drawCollectibles(t);
    drawPlayerCharacter(t);
    endMode2D();
    drawHUD(sw, sh);
    drawLevelCompleteScreen(t, sw, sh);

    let lcAnyTap = 0.0;
    if ((MOBILE > 0.5 || WATCH > 0.5) && getTouchCount() > 0.0) lcAnyTap = 1.0;
    if (isKeyPressed(K_ENTER) || lcAnyTap > 0.5 || GP[GP_CONFIRM] > 0.5) {
      GS[GI_STATE] = ST_LEVEL_SELECT;
      GS[GI_SEL] = GS[GI_LEVEL] + 1.0;
      if (GS[GI_SEL] >= GS[GI_LCOUNT]) GS[GI_SEL] = 0.0;
      switchMusic(1.0);
    }
  }
});

closeAudioDevice();
closeWindow();
