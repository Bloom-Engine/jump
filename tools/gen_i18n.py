# Language order (matches landing): 0 en,1 de,2 es,3 fr,4 it,5 ja,6 ko,7 pt,8 th,9 tr,10 vi,11 id,12 zh-Hans
LANGS = ["en","de","es","fr","it","ja","ko","pt","th","tr","vi","id","zh"]
# key -> [13 translations]
T = {
 "LOADING":      ["Loading...","Lädt...","Cargando...","Chargement...","Caricamento...","読み込み中...","불러오는 중...","Carregando...","กำลังโหลด...","Yükleniyor...","Đang tải...","Memuat...","加载中..."],
 "SUBTITLE":     ["A Bloom Engine Platformer","Ein Bloom Engine Jump-'n'-Run","Un plataformas de Bloom Engine","Un jeu de plateforme Bloom Engine","Un platform di Bloom Engine","Bloom Engine プラットフォーマー","Bloom Engine 플랫포머","Um plataforma da Bloom Engine","เกมแพลตฟอร์ม Bloom Engine","Bir Bloom Engine platform oyunu","Game nền tảng Bloom Engine","Platformer Bloom Engine","Bloom Engine 平台游戏"],
 "PLAY":         ["Play Game","Spielen","Jugar","Jouer","Gioca","ゲーム開始","게임 시작","Jogar","เริ่มเกม","Oyna","Chơi","Main","开始游戏"],
 "INFO":         ["Info","Info","Información","Infos","Info","情報","정보","Info","ข้อมูล","Bilgi","Thông tin","Info","信息"],
 "HINT_KB":      ["Arrow Keys / WASD to move, SPACE to jump","Pfeiltasten / WASD bewegen, LEERTASTE springen","Flechas / WASD mover, ESPACIO saltar","Flèches / WASD pour bouger, ESPACE pour sauter","Frecce / WASD muovi, SPAZIO salta","矢印 / WASD で移動、スペースでジャンプ","화살표 / WASD 이동, 스페이스 점프","Setas / WASD mover, ESPAÇO pular","ลูกศร / WASD เคลื่อนที่, เว้นวรรค กระโดด","Yön tuşları / WASD hareket, BOŞLUK zıpla","Phím mũi tên / WASD di chuyển, SPACE nhảy","Panah / WASD bergerak, SPASI lompat","方向键 / WASD 移动，空格跳跃"],
 "HINT_TOUCH_PLAY":["Tap Play to begin","Zum Starten tippen","Toca Jugar para empezar","Touchez Jouer pour commencer","Tocca Gioca per iniziare","タップして開始","탭하여 시작","Toque em Jogar para começar","แตะเล่นเพื่อเริ่ม","Başlamak için dokun","Chạm Chơi để bắt đầu","Ketuk Main untuk mulai","点击开始"],
 "HINT_TV_SELECT":["Press A to select","A drücken zum Auswählen","Pulsa A para seleccionar","Appuyez sur A pour sélectionner","Premi A per selezionare","A で選択","A로 선택","Pressione A para selecionar","กด A เพื่อเลือก","Seçmek için A'ya bas","Nhấn A để chọn","Tekan A untuk pilih","按 A 选择"],
 "HINT_CROWN":   ["Crown to move, tap to jump","Krone bewegen, tippen springen","Corona mover, toca saltar","Couronne pour bouger, touchez pour sauter","Corona muovi, tocca salta","クラウンで移動、タップでジャンプ","크라운 이동, 탭 점프","Coroa mover, toque pular","หมุนคราวน์เคลื่อนที่ แตะกระโดด","Taç ile hareket, dokun zıpla","Vương miện di chuyển, chạm nhảy","Crown bergerak, ketuk lompat","表冠移动，点击跳跃"],
 "SELECT_LEVEL": ["SELECT LEVEL","LEVEL WÄHLEN","ELEGIR NIVEL","CHOISIR UN NIVEAU","SCEGLI LIVELLO","レベル選択","레벨 선택","ESCOLHER NÍVEL","เลือกด่าน","SEVİYE SEÇ","CHỌN MÀN","PILIH LEVEL","选择关卡"],
 "BACK":         ["< Back","< Zurück","< Atrás","< Retour","< Indietro","< 戻る","< 뒤로","< Voltar","< กลับ","< Geri","< Quay lại","< Kembali","< 返回"],
 "HINT_LS_KB":   ["Click or ENTER to play, ESC / Back to return","Klick oder ENTER spielen, ESC / Zurück","Clic o ENTER jugar, ESC / Atrás","Clic ou ENTRÉE jouer, ÉCHAP / Retour","Clic o INVIO gioca, ESC / Indietro","クリックかENTERで開始、ESCで戻る","클릭/ENTER 시작, ESC 뒤로","Clique ou ENTER jogar, ESC / Voltar","คลิกหรือ ENTER เล่น, ESC กลับ","Tıkla/ENTER oyna, ESC geri","Nhấp/ENTER chơi, ESC quay lại","Klik/ENTER main, ESC kembali","点击或回车开始，ESC 返回"],
 "HINT_LS_TOUCH":["Tap a level to play","Level antippen zum Spielen","Toca un nivel para jugar","Touchez un niveau pour jouer","Tocca un livello per giocare","レベルをタップして開始","레벨을 탭하여 시작","Toque num nível para jogar","แตะด่านเพื่อเล่น","Oynamak için seviyeye dokun","Chạm màn để chơi","Ketuk level untuk main","点击关卡开始"],
 "HINT_LS_TV":   ["A to play, Menu to go back","A spielen, Menü zurück","A jugar, Menú atrás","A jouer, Menu retour","A gioca, Menu indietro","A で開始、メニューで戻る","A 시작, 메뉴 뒤로","A jogar, Menu voltar","A เล่น, เมนู กลับ","A oyna, Menü geri","A chơi, Menu quay lại","A main, Menu kembali","A 开始，菜单返回"],
 "NO_LEVELS1":   ["No levels found","Keine Level gefunden","No se encontraron niveles","Aucun niveau trouvé","Nessun livello trovato","レベルが見つかりません","레벨을 찾을 수 없음","Nenhum nível encontrado","ไม่พบด่าน","Seviye bulunamadı","Không tìm thấy màn","Tidak ada level","未找到关卡"],
 "NO_LEVELS2":   ["Run the editor to create levels!","Erstelle Level im Editor!","¡Usa el editor para crear niveles!","Utilisez l'éditeur pour créer des niveaux !","Usa l'editor per creare livelli!","エディタでレベルを作成！","에디터로 레벨을 만드세요!","Use o editor para criar níveis!","ใช้เอดิเตอร์สร้างด่าน!","Seviye oluşturmak için editörü kullan!","Dùng trình chỉnh sửa để tạo màn!","Gunakan editor untuk membuat level!","用编辑器创建关卡！"],
 "PAUSED":       ["PAUSED","PAUSE","PAUSA","PAUSE","PAUSA","一時停止","일시정지","PAUSA","หยุดชั่วคราว","DURAKLATILDI","TẠM DỪNG","JEDA","已暂停"],
 "RESUME":       ["Resume","Weiter","Continuar","Reprendre","Riprendi","再開","계속","Continuar","เล่นต่อ","Devam","Tiếp tục","Lanjut","继续"],
 "QUIT_MENU":    ["Quit to Menu","Zum Menü","Salir al menú","Quitter au menu","Esci al menu","メニューへ","메뉴로 나가기","Sair para o menu","กลับเมนู","Menüye dön","Về menu","Ke menu","退出到菜单"],
 "HINT_PAUSE_KB":["Click a button, or ESC to Resume / Q to Quit","Knopf klicken, ESC weiter / Q beenden","Clic, ESC continuar / Q salir","Cliquez, ÉCHAP reprendre / Q quitter","Clicca, ESC riprendi / Q esci","クリック、ESCで再開 / Qで終了","클릭, ESC 계속 / Q 종료","Clique, ESC continuar / Q sair","คลิก, ESC เล่นต่อ / Q ออก","Tıkla, ESC devam / Q çık","Nhấp, ESC tiếp / Q thoát","Klik, ESC lanjut / Q keluar","点击，ESC 继续 / Q 退出"],
 "HINT_PAUSE_TOUCH":["Tap to Resume or Quit","Tippen: Weiter oder Beenden","Toca para continuar o salir","Touchez pour reprendre ou quitter","Tocca per riprendere o uscire","タップで再開・終了","탭하여 계속/종료","Toque para continuar ou sair","แตะเพื่อเล่นต่อหรือออก","Devam/çıkış için dokun","Chạm để tiếp/thoát","Ketuk untuk lanjut/keluar","点击继续或退出"],
 "HINT_PAUSE_TV":["A to Resume, Menu to Quit","A weiter, Menü beenden","A continuar, Menú salir","A reprendre, Menu quitter","A riprendi, Menu esci","A で再開、メニューで終了","A 계속, 메뉴 종료","A continuar, Menu sair","A เล่นต่อ, เมนู ออก","A devam, Menü çık","A tiếp, Menu thoát","A lanjut, Menu keluar","A 继续，菜单退出"],
 "GAME_OVER":    ["GAME OVER","GAME OVER","FIN DEL JUEGO","PARTIE TERMINÉE","GAME OVER","ゲームオーバー","게임 오버","FIM DE JOGO","เกมโอเวอร์","OYUN BİTTİ","HẾT LƯỢT","GAME OVER","游戏结束"],
 "COINS":        ["Coins","Münzen","Monedas","Pièces","Monete","コイン","코인","Moedas","เหรียญ","Para","Xu","Koin","金币"],
 "GEMS":         ["Gems","Edelsteine","Gemas","Gemmes","Gemme","ジェム","보석","Gemas","อัญมณี","Mücevher","Ngọc","Permata","宝石"],
 "LIVES":        ["Lives","Leben","Vidas","Vies","Vite","残機","목숨","Vidas","ชีวิต","Can","Mạng","Nyawa","生命"],
 "HINT_CONT_TOUCH":["Tap to continue","Tippen zum Fortfahren","Toca para continuar","Touchez pour continuer","Tocca per continuare","タップで続行","탭하여 계속","Toque para continuar","แตะเพื่อไปต่อ","Devam için dokun","Chạm để tiếp tục","Ketuk untuk lanjut","点击继续"],
 "HINT_CONT_TV": ["Press A to continue","A drücken zum Fortfahren","Pulsa A para continuar","Appuyez sur A pour continuer","Premi A per continuare","A で続行","A로 계속","Pressione A para continuar","กด A เพื่อไปต่อ","Devam için A'ya bas","Nhấn A để tiếp tục","Tekan A untuk lanjut","按 A 继续"],
 "HINT_CONT_KB": ["Press ENTER to continue","ENTER drücken zum Fortfahren","Pulsa ENTER para continuar","Appuyez sur ENTRÉE pour continuer","Premi INVIO per continuare","ENTER で続行","ENTER로 계속","Pressione ENTER para continuar","กด ENTER เพื่อไปต่อ","Devam için ENTER'a bas","Nhấn ENTER để tiếp tục","Tekan ENTER untuk lanjut","按回车继续"],
 "LEVEL_COMPLETE":["LEVEL COMPLETE!","LEVEL GESCHAFFT!","¡NIVEL COMPLETADO!","NIVEAU TERMINÉ !","LIVELLO COMPLETATO!","レベルクリア！","레벨 완료!","NÍVEL CONCLUÍDO!","ผ่านด่าน!","SEVİYE TAMAM!","HOÀN THÀNH MÀN!","LEVEL SELESAI!","关卡完成！"],
 "LEVEL":        ["Level","Level","Nivel","Niveau","Livello","レベル","레벨","Nível","ด่าน","Seviye","Màn","Level","关卡"],
 "CUSTOM":       ["Custom","Eigen","Personalizado","Perso","Personalizzato","カスタム","커스텀","Personalizado","กำหนดเอง","Özel","Tùy chỉnh","Kustom","自定义"],
 "JUMP":         ["Jump","Springen","Saltar","Sauter","Salta","ジャンプ","점프","Pular","กระโดด","Zıpla","Nhảy","Lompat","跳"],
 "GOAL":         ["GOAL","ZIEL","META","BUT","TRAGUARDO","ゴール","골","META","เป้าหมาย","HEDEF","ĐÍCH","TUJUAN","终点"],
}
# sanity: every key has exactly 13
for k,v in T.items():
    assert len(v)==13, f"{k} has {len(v)}"
KEYS=list(T.keys())
# emit TS
out=[]
out.append("// ============================================================")
out.append("// I18N — auto-generated translation table (13 languages).")
out.append("// Language index from getLanguage(); see pickLanguage(). CJK/Thai")
out.append("// (ja/ko/th/zh) fall back to English until the Unicode font ships")
out.append("// (CJK_FONT_READY). Edit tools/gen_i18n.py to regenerate.")
out.append("// ============================================================")
out.append("const CJK_FONT_READY = false; // set true once assets/fonts CJK+Thai font is bundled")
# pickLanguage
def packed(code): return ord(code[0])*256+ord(code[1])
out.append("function pickLanguage(): number {")
out.append("  const v = getLanguage();")
# map each lang code to index; CJK/Thai gated
gates={5,6,8,12}
conds=[]
for i,code in enumerate(LANGS):
    p=packed(code)
    if i in gates:
        conds.append(f"  if (v === {p}.0) return CJK_FONT_READY ? {i} : 0; // {code}")
    else:
        conds.append(f"  if (v === {p}.0) return {i}; // {code}")
out.extend(conds)
out.append("  return 0; // default English")
out.append("}")
out.append("const LANG = pickLanguage();")
out.append("function L(a: string[]): string { return a[LANG]; }")
out.append("")
def esc(s): return s.replace("\\","\\\\").replace('"','\\"')
for k in KEYS:
    arr=", ".join('"'+esc(x)+'"' for x in T[k])
    out.append(f"const TR_{k}: string[] = [{arr}];")
block="\n".join(out)+"\n"
open("/tmp/i18n_block.ts","w").write(block)
print(f"Generated {len(KEYS)} strings x 13 languages.")
print("packed codes:", {c:packed(c) for c in LANGS})
print("--- first lines ---")
print("\n".join(out[:18]))
