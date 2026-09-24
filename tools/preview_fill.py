"""ALAT UJI FASE 0 (bukan engine final): isi tag TEKS di template dengan data uji untuk memeriksa tata letak.
Foto/gambar belum diisi (slot tetap terlihat) - itu tugas Fase 1. Pemakaian:
  python preview_fill.py Template.pptx pohuwato.json keluaran.pptx"""
import copy, datetime as dt, json, re, sys, zipfile
from lxml import etree
NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
A = '{%s}' % NS['a']; P = '{%s}' % NS['p']
TAG = re.compile(r'\{(@?[A-Za-z_][\w.]*)\}')
BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
def num(x, d=0):
    s = f'{x:,.{d}f}'; return s.replace(',', '\0').replace('.', ',').replace('\0', '.')
def tgl(s):
    d = dt.date(*map(int, s.replace('-', '.').split('.'))); return f'{d.day:02d} {BULAN[d.month-1]} {d.year}'
def tgl_d(s): return dt.date(*map(int, s.replace('-', '.').split('.')))

def values(D):
    pd, pr, keg = D['profilDasar'], D['progres'], D['kegiatan']
    fr, fa, kr, ka = pr['fisik']['rencana'], pr['fisik']['realisasi'], pr['keuangan']['rencana'], pr['keuangan']['realisasi']
    hari = (tgl_d(pd['tglSelesai']) - tgl_d(pd['tglMulai'])).days + 1
    rows = [r for r in D['kronologisRaw'] if r['Provinsi'] == keg['provinsi'] and r['Nama Kegiatan'] == keg['namaKegiatan'] and r.get('IsKronologis') == 'Ya']
    rows.sort(key=lambda r: r['Tanggal'])
    v = {'judul_kegiatan': pd['judul'].upper(), 'lokasi': pd['lokasiSingkat'], 'label_program': f"{pd['kodeKontrak']} {pd['tahun']}", 'kode_kontrak': pd['kodeKontrak'],
         'tanggal_cover': tgl(pr['tanggalStatus']), 'nama_pekerjaan': pd['judul'], 'lokasi_pekerjaan': pd['lokasiPekerjaan'],
         'masa_pelaksanaan': f"{hari} Hari Kalender ({tgl(pd['tglMulai']).lstrip('0')} – {tgl(pd['tglSelesai'])})",
         'luas_persil': f"{num(pd['luasPersil'])} m2" if pd.get('luasPersil') else '', 'luas_bangunan': f"{num(pd['luasBangunan'])} m2" if pd.get('luasBangunan') else '',
         'cap_pra': pd['capPra'], 'cap_pasca': pd['capPasca'], 'tanggal_status': tgl(pr['tanggalStatus']),
         'fisik_rencana': num(fr, 2), 'fisik_realisasi': num(fa, 2), 'fisik_deviasi': num(fa - fr, 2),
         'keu_rencana': num(kr, 2), 'keu_realisasi': num(ka, 2), 'keu_deviasi': num(ka - kr, 2)}
    lists = {'latar_belakang': pd['latarBelakang'], 'maksud_tujuan': pd['maksudTujuan'], 'lingkup': [x.replace('\xa0', ' ') for x in pd['lingkup']],
             'masalah': pr['masalah'], 'tindak_lanjut': pr['tindakLanjut']}
    groups = {'pihak': [{'peran': p['peran'], 'nama': p['nama'], 'nilai': f"Rp. {num(p['nilai'])}"} for p in pd['pihak']],
              'kron': [{'no': str(i + 1), 'tanggal': r['Tanggal'], 'uraian': r['Perihal'], 'nomor': r['Nomor Surat'], 'dari': r['AlurDari'], 'ke': r['AlurKe']} for i, r in enumerate(rows)]}
    return v, lists, groups

def ptext(p): return ''.join(x.text or '' for x in p.iter(A + 't'))
def set_text(p, text):
    ts = list(p.iter(A + 't'))
    if not ts: return
    ts[0].text = text
    for t in ts[1:]: t.getparent().getparent().remove(t.getparent()) if t.getparent().tag == A + 'r' else None
def fill(root, v, lists, groups, zebra):
    # 1) tabel: grup baris
    for tbl in root.iter(A + 'tbl'):
        trs = tbl.findall(A + 'tr'); i = 0
        while i < len(trs):
            tags = {m.group(1).split('.')[0] for m in TAG.finditer(ptext(trs[i]) if False else ''.join(ptext(p) for p in trs[i].iter(A + 'p'))) if '.' in m.group(1)}
            if tags:
                name = next(iter(tags)); j = i
                while j + 1 < len(trs) and name + '.' in ''.join(ptext(p) for p in trs[j + 1].iter(A + 'p')): j += 1
                proto = trs[i:j + 1]; anchor = proto[-1]; items = groups.get(name, [])
                for k, item in enumerate(items):
                    for pr in proto:
                        c = copy.deepcopy(pr)
                        for p in c.iter(A + 'p'):
                            t = ptext(p)
                            for m in TAG.finditer(t): 
                                key = m.group(1).split('.', 1)[1]; t = t.replace(m.group(0), str(item.get(key, '')))
                            set_text(p, t)
                        if zebra and name == 'kron':
                            for fill_el in c.iter(A + 'tcPr'):
                                sf = fill_el.find(A + 'solidFill')
                                if sf is not None: sf[0].set('val', zebra[k % 2])
                        anchor.addnext(c); anchor = c
                for pr in proto: tbl.remove(pr)
                trs = tbl.findall(A + 'tr'); i = trs.index(anchor) + 1 if items else i
            else: i += 1
    # 2) paragraf list {@x}
    for p in list(root.iter(A + 'p')):
        m = re.fullmatch(r'\{@([\w]+)\}', ptext(p).strip())
        if m:
            anchor = p
            for item in lists.get(m.group(1), []):
                c = copy.deepcopy(p); set_text(c, item); anchor.addnext(c); anchor = c
            p.getparent().remove(p)
    # 3) tag tunggal + buang baris/bentuk yang semua tag-nya kosong
    for p in root.iter(A + 'p'):
        t = ptext(p)
        if TAG.search(t): set_text(p, TAG.sub(lambda m: str(v.get(m.group(1), '')), t))
def run(tpl, data, out):
    D = json.load(open(data, encoding='utf8')); v, lists, groups = values(D)
    zin = zipfile.ZipFile(tpl); zout = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
    for it in zin.infolist():
        b = zin.read(it.filename)
        if re.fullmatch(r'ppt/slides/slide\d+\.xml', it.filename):
            root = etree.fromstring(b); fill(root, v, lists, groups, ['FFFFFF', 'E8F1F5']); b = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        zout.writestr(it, b)
    zout.close(); print('tulis', out, '| baris kronologis:', len(groups['kron']), '| deviasi fisik:', v['fisik_deviasi'], '| masa:', v['masa_pelaksanaan'])
run(*sys.argv[1:4])
