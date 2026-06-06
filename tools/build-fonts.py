#!/usr/bin/env python3
"""Build the bundled CJK/Thai subset fonts for Bloom Jump.

Downloads Google's Noto Sans JP/KR/SC/Thai (OFL 1.1), subsets each to ONLY the
glyphs the game renders (read from gen_i18n.py) plus Latin/digits, instances the
variable fonts to a static weight, and writes assets/fonts/bloom_{ja,ko,zh,th}.ttf.

Each font is self-contained (its script + Latin) so the UI's numbers and the
"BLOOM JUMP" title render in CJK/Thai mode too. Only one loads at runtime.

Requires: fonttools  (pip install fonttools)
Run from the project root:  python3 tools/build-fonts.py
"""
import os, re, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.subset import Subsetter, Options

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = {
 'ja': ("https://github.com/google/fonts/raw/main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf", {'wght':400}),
 'ko': ("https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf", {'wght':400}),
 'zh': ("https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf", {'wght':400}),
 'th': ("https://github.com/google/fonts/raw/main/ofl/notosansthai/NotoSansThai%5Bwdth,wght%5D.ttf", {'wght':400,'wdth':100}),
}
IDX = {'ja':5, 'ko':6, 'th':8, 'zh':12}  # column in gen_i18n.py translation arrays
DROP = ['GDEF','GPOS','GSUB','HVAR','MVAR','STAT','VVAR','gvar','fvar','avar','BASE']
LATIN = set(range(0x20,0x7F)) | set(range(0xA0,0x100))

def needed_chars():
    txt = open(os.path.join(ROOT,'tools','gen_i18n.py')).read()
    out = {k:set() for k in IDX}
    for a in re.findall(r'\[(.*?)\]', txt):
        items = re.findall(r'"((?:[^"\\]|\\.)*)"', a)
        if len(items)!=13: continue
        for lang,col in IDX.items():
            for ch in items[col]:
                if ord(ch) > 0x2000: out[lang].add(ord(ch))
    return out

def main():
    chars = needed_chars()
    os.makedirs(os.path.join(ROOT,'assets','fonts'), exist_ok=True)
    for lang,(url,pin) in SRC.items():
        tmp = f"/tmp/_noto_{lang}.ttf"
        if not os.path.exists(tmp):
            print(f"downloading {lang} ...")
            urllib.request.urlretrieve(url, tmp)
        f = instancer.instantiateVariableFont(TTFont(tmp), pin, inplace=False)
        for t in DROP:
            if t in f: del f[t]
        opt = Options(); opt.glyph_names=False; opt.notdef_outline=True
        opt.layout_features=[]; opt.name_IDs=['*']; opt.recalc_bounds=True
        ss = Subsetter(options=opt)
        ss.populate(unicodes=sorted(LATIN | chars[lang]))
        ss.subset(f)
        fam = f"Bloom {lang.upper()}"
        for rec in list(f['name'].names):
            if rec.nameID in (1,4,16): rec.string = fam
            elif rec.nameID == 6: rec.string = fam.replace(' ','')+"-Regular"
        outp = os.path.join(ROOT,'assets','fonts',f'bloom_{lang}.ttf')
        f.save(outp)
        print(f"  wrote {outp}  ({os.path.getsize(outp)//1024} KB)")

if __name__ == '__main__':
    main()
