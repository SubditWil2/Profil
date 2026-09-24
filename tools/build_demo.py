"""Membuat profil_demo.html: satu berkas mandiri (skrip, template, data uji, foto uji ditanam) untuk diuji di HP tanpa server.
Pemakaian: python build_demo.py <folder profil> <keluaran.html>"""
import base64, io, json, os, re, sys
from PIL import Image
R, OUT = sys.argv[1].rstrip('/'), sys.argv[2]
b64 = lambda b: base64.b64encode(b).decode()
data = json.load(open(f'{R}/sample_data/pohuwato.json', encoding='utf8'))
keys = set(data['profilDasar']['aset'].values()) | {data['progres']['kurvaS']} | {f['file'] for f in data['foto']}
files = {}
for k in sorted(keys):
    im = Image.open(f'{R}/sample_data/{k}').convert('RGB'); im.thumbnail((1100, 1100), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=74, optimize=True); files[k] = b64(buf.getvalue())
embed = {'template': b64(open(f'{R}/templates/Template_Profil_Kegiatan.pptx', 'rb').read()),
         'manifest': json.load(open(f'{R}/templates/template_manifest.json', encoding='utf8')), 'data': data, 'files': files}
html = open(f'{R}/profil.html', encoding='utf8').read()
def inline(m):
    js = open(f'{R}/{m.group(1)}', encoding='utf8').read()
    assert '</script' not in js.lower(), m.group(1)
    return f'<script>/* {m.group(1)} */\n{js}\n</script>'
# konfigurasi demo: tanpa URL flow apa pun (halaman demo tidak boleh membawa alamat/tanda tangan flow asli)
html = html.replace('<script src="profil-config.js"></script>', '<script>window.PROFIL_CONFIG={getDataFlowUrl:"",saveFlowUrl:"",readFlowUrl:"",maxPayloadMB:50,timeoutMs:180000,pembuatList:["Uji Coba"]};</script>')
html = re.sub(r'<script src="((?:profil-kit|profil-builders|pptx-engine|profil-live|profil-save|profil-master|profil-ai)\.js)"></script>', inline, html)
emb = json.dumps(embed, ensure_ascii=False).replace('</', '<\\/')
pz = open(f'{R}/libs/pizzip.min.js', encoding='utf8').read(); assert '</script' not in pz.lower()
html = html.replace('<script src="libs/pizzip.min.js"></script>', f'<script>window.PROFIL_EMBED={emb};</script>\n<script>/* pizzip 3.2.0 (MIT/GPL-3.0) */\n{pz}\n</script>', 1)
assert 'src="libs/' not in html and not re.search(r'<(?:script|link)[^>]+(?:src|href)="https?://', html), 'masih ada skrip/tautan eksternal'
assert not re.search(r'https://[^"\' ]*powerplatform', html), 'URL flow tidak boleh tertanam di demo'
html = html.replace('<p>Subdit Wil 2 BPB · Fase 1 (mandiri, belum terhubung ke DMS)</p>', '<p>Demo Fase 1 · data uji Pohuwato tertanam (foto 1100 px) · belum terhubung ke DMS</p>')
html = html.replace('Subdit Wil 2 BPB · Fase 1 (mandiri, belum terhubung ke DMS)', 'Demo Fase 1 · data uji Pohuwato tertanam (foto 1100 px) · belum terhubung ke DMS')
open(OUT, 'w', encoding='utf8').write(html); print(OUT, round(len(html.encode()) / 1048576, 1), 'MB')
