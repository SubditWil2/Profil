/* Membuat berkas payload contoh untuk menguji flow SimpanProfil di Power Automate (tab Test) atau curl.
   node tests/make_payload.js <keluaran.json> [--kecil]   (--kecil: tanpa foto, PPTX ~3 MB) */
const fs = require('fs'), path = require('path'), PizZip = require('pizzip'), { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const _is = require('image-size'), sizeOf = _is.imageSize || _is.default || _is;
const ROOT = path.join(__dirname, '..'), B = require('../profil-builders.js'), E = require('../pptx-engine.js'), S = require('../profil-save.js');
const out = process.argv[2] || 'contoh_payload.json', kecil = process.argv.includes('--kecil');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/template_manifest.json'), 'utf8')), data = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample_data/pohuwato.json'), 'utf8'));
if (kecil) { data.foto = []; data.progres.kurvaS = null; data.profilDasar.aset = {}; }
const { plan } = B.buildSlidePlan(data, { manifest });
const images = {}; B.imageKeys(plan).forEach(k => { const b = fs.readFileSync(path.join(ROOT, 'sample_data', k)); const d = sizeOf(b); images[k] = { data: new Uint8Array(b), w: d.width, h: d.height, ext: 'jpg' }; });
const r = E.render({ templateBytes: fs.readFileSync(path.join(ROOT, 'templates/Template_Profil_Kegiatan.pptx')), manifest, plan, images, env: { PizZip, DOMParser, XMLSerializer } });
const p = S.buildPayload({ data, pptxBytes: r.bytes, jumlahSlide: plan.length, kegiatanList: [data.kegiatan.namaKegiatan], pic: 'Uji Coba' });
p.fileName = 'UJI ' + p.fileName;   // supaya tidak menimpa file asli saat pengujian flow
fs.writeFileSync(out, JSON.stringify(p)); console.log(out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB', '|', p.targetFolderPath, '|', p.fileName);
