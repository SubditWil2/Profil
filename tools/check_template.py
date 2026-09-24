"""Validator template profil. Pemakaian: python check_template.py Template_Profil_Kegiatan.pptx template_manifest.json
Keluar dengan kode 1 jika ada ERROR. Dipakai di Fase 0 (Python) dan akan dipindah ke JS saat engine dimuat."""
import json, re, sys, zipfile
from lxml import etree
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
A = '{%s}' % NS['a']; P = '{%s}' % NS['p']
TAG = re.compile(r'\{(@?[A-Za-z_][\w.]*)\}')
errors, warns = [], []
pptx, manifest = sys.argv[1], json.load(open(sys.argv[2], encoding='utf8'))
z = zipfile.ZipFile(pptx)

def rels(part):
    p = part.rsplit('/', 1); rp = f'{p[0]}/_rels/{p[1]}.rels'
    return etree.fromstring(z.read(rp)) if rp in z.namelist() else None
pres = etree.fromstring(z.read('ppt/presentation.xml')); prels = {r.get('Id'): r.get('Target') for r in rels('ppt/presentation.xml')}
slides = ['ppt/' + prels[s.get('{%s}id' % NS['r'])] for s in pres.iter(P + 'sldId')]
order = manifest['slideOrder']
if len(slides) != len(order): errors.append(f'jumlah slide {len(slides)} != {len(order)} prototipe di manifest')

total_media = sum(i.file_size for i in z.infolist() if i.filename.startswith('ppt/media/'))
if total_media > 5 * 1024 * 1024: warns.append(f'media template {total_media/1048576:.1f} MB (>5 MB); template dimuat browser tiap generate')

for name, part in zip(order, slides):
    spec = manifest['prototypes'][name]; root = etree.fromstring(z.read(part)); tag = f'[{name}]'
    # relasi eksternal (mis. tautan ke Excel di SharePoint) dilarang
    r = rels(part)
    if r is not None:
        for x in r:
            if x.get('TargetMode') == 'External': errors.append(f'{tag} relasi eksternal: {x.get("Target")[:80]}')
    ids = [c.get('id') for c in root.iter(P + 'cNvPr')]
    if len(ids) != len(set(ids)): errors.append(f'{tag} ID shape tidak unik')
    found, split = set(), 0
    alltext = []
    for p in root.iter(A + 'p'):
        runs = ''.join(x.text or '' for x in p.iter(A + 't')); alltext.append(runs)
        for m in TAG.finditer(runs): found.add(m.group(1))
        rem = TAG.sub('', runs)
        if '{' in rem or '}' in rem: errors.append(f'{tag} kurung kurawal tidak valid: {runs[:60]!r}')
        for t in p.iter(A + 't'):    # tag terbelah antar-run?
            if t.text and (t.text.count('{') != t.text.count('}')): split += 1
    if split: warns.append(f'{tag} {split} tag terbelah antar-run (engine akan menggabungkan)')
    want = set(spec['tags'])
    if want - found: errors.append(f'{tag} tag di manifest tapi tidak ada di template: {sorted(want - found)}')
    if found - want: errors.append(f'{tag} tag di template tapi tidak ada di manifest: {sorted(found - want)}')
    txt = ' '.join(alltext)
    if re.search(r'pohuwato|gorontalo|\bPT\.|Manggala|Cipta Adhi', txt, re.I): errors.append(f'{tag} masih ada teks contoh: {re.findall(r"pohuwato|gorontalo|Manggala|Cipta Adhi", txt, re.I)[:3]}')
    names = {c.get('name'): c for c in root.iter(P + 'cNvPr')}
    for kind in ('slots', 'areas', 'protos', 'fits'):
        for nm in spec.get(kind, []):
            if nm not in names: errors.append(f'{tag} bentuk "{nm}" tidak ada'); continue
            el = names[nm]
            while el is not None and etree.QName(el).localname not in ('sp', 'pic', 'graphicFrame'): el = el.getparent()
            ext = el.find('.//a:ext[@cx]', NS); off = el.find('.//a:off', NS)
            if ext is None or int(ext.get('cx')) <= 0 or int(ext.get('cy')) <= 0: errors.append(f'{tag} "{nm}" berukuran 0')
            if kind == 'protos' and int(off.get('x')) < 12192000: warns.append(f'{tag} "{nm}" ada di dalam kanvas (seharusnya di pasteboard)')
    # tidak boleh ada gambar sisa contoh di slide dinamis
    if name in ('kronologis', 'latar', 'profil', 'kurvas', 'dokumentasi') and list(root.iter(P + 'pic')):
        errors.append(f'{tag} masih ada gambar contoh (p:pic) di slide prototipe')
    for tn, ts in spec.get('tables', {}).items():
        if tn not in names: errors.append(f'{tag} tabel "{tn}" tidak ada'); continue
        if 'list' in ts:
            tbl = names[tn]
            while etree.QName(tbl).localname != 'graphicFrame': tbl = tbl.getparent()
            trs = tbl.findall('.//a:tr', NS)
            if len(trs) != 2: errors.append(f'{tag} {tn} harus punya 1 baris header + 1 baris contoh (ada {len(trs)})')
            ncol = len(tbl.findall('.//a:gridCol', NS)); cells = trs[-1].findall('a:tc', NS)
            if len(cells) != ncol: errors.append(f'{tag} {tn} jumlah sel != kolom')
    for p in root.iter(P + 'sp'):
        pass
missing_required = set(manifest['required']) - {t for s in manifest['prototypes'].values() for t in s['tags']}
if missing_required: errors.append(f'required tidak ada di prototipe manapun: {sorted(missing_required)}')

print(f'Template: {pptx}  ({len(slides)} slide, media {total_media/1024:.0f} KB)')
for w in warns: print('  WARN ', w)
for e in errors: print('  ERROR', e)
print('HASIL:', 'GAGAL' if errors else 'LOLOS', f'({len(errors)} error, {len(warns)} peringatan)')
sys.exit(1 if errors else 0)
