"""Fase 0 - ubah deck contoh Pohuwato menjadi Template_Profil_Kegiatan.pptx bertag.
Dijalankan pada folder hasil unzip (tpl/) yang sudah dibersihkan dari slide 7."""
import copy, re, sys
from lxml import etree

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
P = '{%s}' % NS['p']; A = '{%s}' % NS['a']; R = '{%s}' % NS['r']
ROOT = sys.argv[1] if len(sys.argv) > 1 else 'tpl'
OFFCANVAS_X = 12300000   # posisi 'proto:' di luar kanvas (pasteboard)

def load(n): return etree.parse(f'{ROOT}/ppt/slides/slide{n}.xml')
def save(t, n): t.write(f'{ROOT}/ppt/slides/slide{n}.xml', xml_declaration=True, encoding='UTF-8', standalone=True)
def ptext(p): return ''.join(x.text or '' for x in p.iter(A + 't'))
def shape_id(el): return el.find('.//p:cNvPr', NS).get('id')
def by_id(tree, i):
    for el in tree.getroot().find('.//p:spTree', NS):
        c = el.find('.//p:cNvPr', NS)
        if c is not None and c.get('id') == str(i) and etree.QName(el).localname in ('sp', 'pic', 'graphicFrame'):
            return el
    raise KeyError(i)
def spTree(tree): return tree.getroot().find('.//p:spTree', NS)

def set_para(p, text):
    """Ganti isi paragraf dengan satu run (format run pertama dipertahankan); tag tidak terbelah."""
    runs = p.findall(A + 'r')
    for x in p.findall(A + 'fld') + p.findall(A + 'br'): p.remove(x)
    if runs:
        first = runs[0]
        for r in runs[1:]: p.remove(r)
    else:
        first = etree.SubElement(p, A + 'r'); etree.SubElement(first, A + 't')
        end = p.find(A + 'endParaRPr')
        if end is not None:
            rpr = copy.deepcopy(end); rpr.tag = A + 'rPr'; first.insert(0, rpr); p.remove(end); p.append(end)
    rpr = first.find(A + 'rPr')
    if rpr is not None:
        rpr.attrib.pop('err', None); rpr.set('dirty', '0')
    first.find(A + 't').text = text

def nonempty_paras(container): return [p for p in container.iter(A + 'p') if ptext(p).strip()]

def as_list_proto(container, tag):
    """Paragraf tak kosong pertama jadi prototipe {@tag}; paragraf lain (termasuk kosong) dibuang."""
    paras = list(container.iter(A + 'p')); ne = nonempty_paras(container)
    keep = ne[0]; set_para(keep, '{@%s}' % tag)
    for p in paras:
        if p is not keep: p.getparent().remove(p)

def max_id(tree): return max(int(c.get('id')) for c in tree.getroot().iter(P + 'cNvPr'))

def placeholder(tree, name, x, y, cx, cy, label):
    xml = f'''<p:sp xmlns:p="{NS['p']}" xmlns:a="{NS['a']}"><p:nvSpPr><p:cNvPr id="{max_id(tree)+1}" name="{name}" descr="Slot otomatis. Jangan dihapus."/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
<a:solidFill><a:srgbClr val="EEF3F6"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="156082"/></a:solidFill><a:prstDash val="dash"/></a:ln></p:spPr>
<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="id-ID" sz="1200" b="1" dirty="0"><a:solidFill><a:srgbClr val="156082"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>{label}</a:t></a:r></a:p></p:txBody></p:sp>'''
    return etree.fromstring(xml)

def replace_with_slot(tree, el, name, label):
    off = el.find('.//a:off', NS); ext = el.find('.//a:ext[@cx]', NS)
    slot = placeholder(tree, name, int(off.get('x')), int(off.get('y')), int(ext.get('cx')), int(ext.get('cy')), label)
    el.getparent().replace(el, slot); return slot

def remove(tree, ids):
    for i in ids:
        el = by_id(tree, i); el.getparent().remove(el)

def make_proto(el, name, text):
    """Ubah bentuk keterangan contoh jadi prototipe di luar kanvas (gaya keterangan dapat diedit desainer)."""
    c = el.find('.//p:cNvPr', NS); c.set('name', name); c.set('descr', 'Gaya keterangan foto. Disalin oleh generator; jangan dihapus.')
    el.find('.//a:off', NS).set('x', str(OFFCANVAS_X))
    ps = list(el.iter(A + 'p')); set_para(ps[0], text)
    for p in ps[1:]: p.getparent().remove(p)

def global_tags(tree):
    """Judul kegiatan, label program, lokasi di header semua slide (hanya p:sp, bukan tabel)."""
    for sp in tree.getroot().iter(P + 'sp'):
        for p in sp.iter(A + 'p'):
            t = ptext(p).strip()
            if t.upper() == 'PEMBANGUNAN KANTOR BUPATI POHUWATO': set_para(p, '{judul_kegiatan}')
            elif t == 'SYC 2026': set_para(p, '{label_program}')
            elif t == 'Kab. Pohuwato, Provinsi Gorontalo': set_para(p, '{lokasi}')

def cell_para(tbl, r, c):
    row = tbl.findall('.//a:tr', NS)[r]; return list(row.findall('a:tc', NS)[c].iter(A + 'p'))[0]
def cell_tc(tbl, r, c): return tbl.findall('.//a:tr', NS)[r].findall('a:tc', NS)[c]

# ------------------------------------------------------------------ slide 1: cover
t = load(1)
for p in t.getroot().iter(A + 'p'):
    tx = ptext(p).strip()
    if tx.upper() == 'PEMBANGUNAN KANTOR BUPATI POHUWATO': set_para(p, '{judul_kegiatan}')
    elif re.match(r'^\d{2} \w+ \d{4}$', tx): set_para(p, '{tanggal_cover}')
save(t, 1)

# ------------------------------------------------------------------ slide 2: kronologis (tabel native menggantikan objek tertaut Excel)
t = load(2); tree = spTree(t)
ole = by_id(t, 3); idx = list(tree).index(ole); tree.remove(ole)
rp = f'{ROOT}/ppt/slides/_rels/slide2.xml.rels'; rs = open(rp, encoding='utf8').read()
rs = re.sub(r'<Relationship Id="rId2"[^>]*/>', '', rs); rs = re.sub(r'<Relationship Id="rId3"[^>]*/>', '', rs)   # tautan xlsx + gambar EMF
open(rp, 'w', encoding='utf8').write(rs)

COLS = [('No', 360000, 'ctr', '{kron.no}'), ('Tanggal', 1100000, 'ctr', '{kron.tanggal}'), ('Uraian / Perihal', 3880000, 'l', '{kron.uraian}'),
        ('Nomor Surat', 1900000, 'ctr', '{kron.nomor}'), ('Alur (Dari)', 2080000, 'ctr', '{kron.dari}'), ('Alur (Ke)', 2272000, 'ctr', '{kron.ke}')]
def tc(text, algn, bold, color, fill):
    ln = lambda k: f'<a:{k} w="6350"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:{k}>'
    return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="{algn}"/><a:r><a:rPr lang="id-ID" sz="900" b="{1 if bold else 0}" dirty="0">'
            f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="Arial"/><a:cs typeface="Arial"/></a:rPr><a:t>{text}</a:t></a:r></a:p></a:txBody>'
            f'<a:tcPr marL="72000" marR="72000" marT="22000" marB="22000" anchor="ctr">{ln("lnL")}{ln("lnR")}{ln("lnT")}{ln("lnB")}<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill></a:tcPr></a:tc>')
hdr = ''.join(tc(h, 'ctr', True, 'FFFFFF', '156082') for h, w, al, tg in COLS)
body = ''.join(tc(tg, al, False, '000000', 'FFFFFF') for h, w, al, tg in COLS)
grid = ''.join(f'<a:gridCol w="{w}"/>' for h, w, al, tg in COLS)
W = sum(w for h, w, al, tg in COLS)
tbl = etree.fromstring(f'''<p:graphicFrame xmlns:p="{NS['p']}" xmlns:a="{NS['a']}"><p:nvGraphicFramePr><p:cNvPr id="3" name="tbl:kron" descr="Tabel kronologis. Baris contoh diduplikasi otomatis."/>
<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="300000" y="850000"/><a:ext cx="{W}" cy="710000"/></p:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1"/><a:tblGrid>{grid}</a:tblGrid>
<a:tr h="300000">{hdr}</a:tr><a:tr h="300000">{body}</a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>''')
tree.insert(idx, tbl)
global_tags(t); save(t, 2)

# ------------------------------------------------------------------ slide 3: latar belakang
t = load(3)
global_tags(t)
def plain_first(paras):
    """Pilih paragraf yang run pertamanya TIDAK tebal sebagai prototipe (paragraf pertama contoh punya kata pembuka tebal)."""
    for p in paras:
        r = p.find(A + 'r'); rpr = r.find(A + 'rPr') if r is not None else None
        if rpr is None or rpr.get('b') != '1': return p
    return paras[0]
def fit_box(tb, name, tag):
    tb.find('.//p:cNvPr', NS).set('name', name)
    ps = list(tb.iter(A + 'p')); body_ps = [p for p in ps[1:] if ptext(p).strip()]
    proto = plain_first(body_ps); set_para(proto, tag)
    for p in ps[1:]:
        if p is not proto: p.getparent().remove(p)
    for rpr in tb.iter(A + 'rPr'): rpr.set('sz', '1400')          # ukuran eksplisit (default deck 14 pt) agar estimasi engine deterministik
fit_box(by_id(t, 28), 'fit:latar', '{@latar_belakang}')
fit_box(by_id(t, 31), 'fit:maksud', '{@maksud_tujuan}')
# dua foto ini berada di dalam grup ber-skala; grup dibongkar dan posisi absolutnya dihitung
grp = [c for c in spTree(t) if etree.QName(c).localname == 'grpSp'][0]
gx = grp.find('p:grpSpPr/a:xfrm', NS)
goff, gext = gx.find('a:off', NS), gx.find('a:ext', NS); choff, chext = gx.find('a:chOff', NS), gx.find('a:chExt', NS)
sx = int(gext.get('cx')) / int(chext.get('cx')); sy = int(gext.get('cy')) / int(chext.get('cy'))
def absrect(pic):
    o, e = pic.find('.//a:off', NS), pic.find('.//a:ext[@cx]', NS)
    return (round(int(goff.get('x')) + (int(o.get('x')) - int(choff.get('x'))) * sx), round(int(goff.get('y')) + (int(o.get('y')) - int(choff.get('y'))) * sy),
            round(int(e.get('cx')) * sx), round(int(e.get('cy')) * sy))
pics = [c for c in grp if etree.QName(c).localname == 'pic']
pos = list(spTree(t)).index(grp)
s1 = placeholder(t, 'img:pra', *absrect(pics[0]), 'SLOT FOTO: kondisi awal')
spTree(t).replace(grp, s1)
s2 = placeholder(t, 'img:pasca', *absrect(pics[1]), 'SLOT FOTO: kondisi berikutnya')
s1.addnext(s2)
set_para(list(by_id(t, 35).iter(A + 'p'))[0], '{cap_pra}')
set_para(list(by_id(t, 38).iter(A + 'p'))[0], '{cap_pasca}')
save(t, 3)

# ------------------------------------------------------------------ slide 4: profil kegiatan
t = load(4); global_tags(t)
remove(t, [10, 11, 12, 13, 14, 45, 54, 55, 4])   # bintik putih sisa logo (tersembunyi di belakang gambar) + label 'Design 3D' yang tertutup gambar
# tabel spesifikasi
gf = by_id(t, 27); gf.find('.//p:cNvPr', NS).set('name', 'tbl:spek'); rows = gf.findall('.//a:tr', NS)
def val(r, c, tag): set_para(list(rows[r].findall('a:tc', NS)[c].iter(A + 'p'))[0], tag)
val(0, 1, '{nama_pekerjaan}'); val(1, 1, '{lokasi_pekerjaan}'); val(2, 1, '{masa_pelaksanaan}')
val(3, 1, '{luas_persil}'); val(4, 1, '{luas_bangunan}')
set_para(list(rows[5].findall('a:tc', NS)[0].iter(A + 'p'))[0], '{pihak.peran}')
val(6, 1, '{pihak.nama}'); val(7, 1, '{pihak.nilai}')
for r in rows[8:11]: r.getparent().remove(r)                 # grup Kontraktor -> digandakan dari grup pertama oleh engine
last = rows[12]; as_list_proto(last.findall('a:tc', NS)[0], 'lingkup'); last.set('h', '152198')
# permasalahan / tindak lanjut
gf2 = by_id(t, 3); gf2.find('.//p:cNvPr', NS).set('name', 'tbl:masalah'); r2 = gf2.findall('.//a:tr', NS)[1].findall('a:tc', NS)
as_list_proto(r2[0], 'masalah'); as_list_proto(r2[1], 'tindak_lanjut')
# status progres
gf3 = by_id(t, 17); gf3.find('.//p:cNvPr', NS).set('name', 'tbl:status'); r3 = gf3.findall('.//a:tr', NS)
set_para(list(r3[0].findall('a:tc', NS)[0].iter(A + 'p'))[0], 'STATUS:  {tanggal_status}')
set_para(list(r3[1].findall('a:tc', NS)[1].iter(A + 'p'))[0], '{label_program}')
set_para(list(r3[1].findall('a:tc', NS)[3].iter(A + 'p'))[0], 'Deviasi {kode_kontrak}')
for ri, pre in ((3, 'fisik'), (4, 'keu')):
    cs = r3[ri].findall('a:tc', NS)
    for ci, suf in ((1, 'rencana'), (2, 'realisasi'), (3, 'deviasi')):
        set_para(list(cs[ci].iter(A + 'p'))[0], '{%s_%s}' % (pre, suf))
# gambar rencana + area foto sorotan + prototipe keterangan
replace_with_slot(t, by_id(t, 5), 'img:design3d', 'SLOT GAMBAR: rencana / design 3D')
for i in (20, 21, 24, 25, 26, 28): remove(t, [i])
for i in (23, 29, 31, 32, 33): remove(t, [i])
make_proto(by_id(t, 22), 'proto:caption', 'KETERANGAN FOTO')
tree = spTree(t)
tree.insert(list(tree).index(by_id(t, 3)) , placeholder(t, 'area:foto', 5772559, 806470, 6210813, 4669741, 'AREA FOTO SOROTAN (0-6 foto, otomatis)'))
save(t, 4)

# ------------------------------------------------------------------ slide 5: kurva S
t = load(5); global_tags(t)
replace_with_slot(t, by_id(t, 20), 'img:kurvas', 'SLOT GAMBAR: KURVA S')
save(t, 5)

# ------------------------------------------------------------------ slide 6: dokumentasi
t = load(6); global_tags(t)
for i in (20, 24, 32, 34, 38): remove(t, [i])
for i in (46, 48, 50, 52): remove(t, [i])
make_proto(by_id(t, 43), 'proto:caption', 'Keterangan foto')
spTree(t).insert(len(list(spTree(t))) - 1, placeholder(t, 'area:foto', 60000, 1000000, 12072000, 5550000, 'AREA FOTO DOKUMENTASI (1-6 foto per slide, otomatis)'))
save(t, 6)
print('OK')

# ------------------------------------------------------------------ bersihkan relasi gambar yatim (gambar contoh sudah dibuang dari slide)
import glob, os
for sp in glob.glob(f'{ROOT}/ppt/slides/slide*.xml'):
    n = os.path.basename(sp)
    xml = open(sp, encoding='utf8').read(); rp = f'{ROOT}/ppt/slides/_rels/{n}.rels'
    rs = open(rp, encoding='utf8').read()
    def keep(m):
        rid = re.search(r'Id="(rId\d+)"', m.group(0)).group(1)
        if '/relationships/image"' in m.group(0) and f'"{rid}"' not in xml: return ''
        return m.group(0)
    open(rp, 'w', encoding='utf8').write(re.sub(r'<Relationship [^>]*/>', keep, rs))

# ------------------------------------------------------------------ font tema/cloud ('Neue Haas Grotesk Text Pro', +mn-lt) di slide 4 -> Arial supaya seragam di semua komputer
p4 = f'{ROOT}/ppt/slides/slide4.xml'
s4 = open(p4, encoding='utf8').read().replace('typeface="Neue Haas Grotesk Text Pro"', 'typeface="Arial"').replace('typeface="+mn-lt"', 'typeface="Arial"')
open(p4, 'w', encoding='utf8').write(s4)
