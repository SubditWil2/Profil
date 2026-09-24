"""Fase 0 / langkah 1: struktur paket + pelangsingan media. Argumen: <folder hasil unzip>."""
import os, re, sys
from PIL import Image
ROOT = sys.argv[1]

# a) buang slide 7 (dokumentasi kedua = duplikat prototipe) dari sldIdLst
pres = open(f'{ROOT}/ppt/presentation.xml', encoding='utf8').read()
rels = open(f'{ROOT}/ppt/_rels/presentation.xml.rels', encoding='utf8').read()
m = re.search(r'Id="(rId\d+)"[^>]*Target="slides/slide7.xml"', rels) or re.search(r'Target="slides/slide7.xml"[^>]*Id="(rId\d+)"', rels)
new = re.sub(r'<p:sldId [^>]*r:id="%s"[^>]*/>' % m.group(1), '', pres); assert new != pres
open(f'{ROOT}/ppt/presentation.xml', 'w', encoding='utf8').write(new)

# b) media latar cover/penutup: PNG besar -> JPEG (5 MB -> ~0,5 MB dan 23 MB -> ~1,2 MB)
def to_jpeg(src, dst, maxw, q=86):
    im = Image.open(src)
    if im.mode == 'RGBA':
        bg = Image.new('RGB', im.size, (255, 255, 255)); bg.paste(im, mask=im.split()[3]); im = bg
    else: im = im.convert('RGB')
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=q, optimize=True)
for n, maxw in (('image14', 2560), ('image36', 2400)):
    src = f'{ROOT}/ppt/media/{n}.png'; to_jpeg(src, f'{ROOT}/ppt/media/{n}.jpeg', maxw); os.remove(src)
    for f in os.listdir(f'{ROOT}/ppt/slides/_rels'):
        p = f'{ROOT}/ppt/slides/_rels/{f}'; s = open(p, encoding='utf8').read()
        if f'media/{n}.png' in s: open(p, 'w', encoding='utf8').write(s.replace(f'media/{n}.png', f'media/{n}.jpeg'))

# c) slide 8: buang efek gambar 'imgProps' yang menunjuk hdphoto2.wdp (3,9 MB, hanya cadangan efek saturasi)
p8 = f'{ROOT}/ppt/slides/slide8.xml'; s8 = open(p8, encoding='utf8').read()
mm = re.search(r'<a:ext uri="\{BEBA8EAE-BF5A-486C-A8C5-ECC9F3942E4B\}">.*?</a:ext>', s8, re.S)
if mm: s8 = s8.replace(mm.group(0), '')
open(p8, 'w', encoding='utf8').write(s8)
r8 = f'{ROOT}/ppt/slides/_rels/slide8.xml.rels'; t = open(r8, encoding='utf8').read()
open(r8, 'w', encoding='utf8').write(re.sub(r'<Relationship [^>]*hdphoto2\.wdp"[^>]*/>', '', t))
print('paket disiapkan')
