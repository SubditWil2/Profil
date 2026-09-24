/* Uji engine di Node (xmldom menggantikan DOMParser browser). Jalankan: npm i && node tests/run_tests.js [folder_keluaran]
   Hasil .pptx diperiksa terpisah (validate.py + render) oleh tests/check_outputs.sh */
const fs = require('fs'), path = require('path');
const PizZip = require('pizzip'), { DOMParser, XMLSerializer } = require('@xmldom/xmldom'), _is = require('image-size'), sizeOf = _is.imageSize || _is.default || _is;
const B = require('../profil-builders.js'), E = require('../pptx-engine.js');
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'tests', 'out');
fs.mkdirSync(OUT, { recursive: true });
const template = fs.readFileSync(path.join(ROOT, 'templates', 'Template_Profil_Kegiatan.pptx'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates', 'template_manifest.json'), 'utf8'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample_data', 'pohuwato.json'), 'utf8'));
const clone = o => JSON.parse(JSON.stringify(o));

const imgCache = {};
function loadImages(keys) {
    const out = {};
    keys.forEach(k => { const f = path.join(ROOT, 'sample_data', k.split('#')[0]); if (!imgCache[f]) { const buf = fs.readFileSync(f); const d = sizeOf(buf); imgCache[f] = { data: new Uint8Array(buf), w: d.width, h: d.height, ext: 'jpg' }; } out[k] = imgCache[f]; });
    return out;
}
const pool = base.foto.map(f => f.file);
const foto = (n, sorot) => Array.from({ length: n }, (_, i) => ({ file: pool[i % pool.length] + (i >= pool.length ? '#' + i : ''), kelompok: 'Bangunan ' + String.fromCharCode(65 + Math.floor(i / 3)), keterangan: 'Tampak ' + ['Depan', 'Samping', 'Belakang'][i % 3], sorotan: i < sorot }));
// key '#i' hanya untuk membedakan entri; loadImages membuang bagian setelah '#'

const scenarios = {
    '01_baseline': d => d,
    '02_foto0': d => { d.foto = []; return d; },
    '03_dok1': d => { d.foto = foto(7, 6); return d; },
    '04_dok2_sorotan0': d => { d.foto = foto(2, 0); return d; },
    '05_dok5_sorotan3': d => { d.foto = foto(8, 3); return d; },
    '06_dok6': d => { d.foto = foto(12, 6); return d; },
    '07_dok7': d => { d.foto = foto(13, 6); return d; },
    '08_dok13': d => { d.foto = foto(19, 6); return d; },
    '09_dok25': d => { d.foto = foto(31, 6); return d; },
    '10_kron0': d => { d.kronologisRaw = []; return d; },
    '11_kron5': d => { d.kronologisRaw = d.kronologisRaw.slice(0, 5); return d; },
    '12_kron40': d => { const r = d.kronologisRaw.filter(x => x.IsKronologis === 'Ya' && x.Provinsi === d.kegiatan.provinsi); const o = []; for (let i = 0; i < 40; i++) o.push(Object.assign({}, r[i % r.length], { Tanggal: '2026.0' + (1 + i % 9) + '.' + String(1 + i % 28).padStart(2, '0') })); d.kronologisRaw = o; return d; },
    '13_karakter_khusus': d => { d.profilDasar.judul = 'Pembangunan "Gedung" A&B <Tahap 1> — Pak Ali\'s Ünïcode'; d.profilDasar.latarBelakang = ['Uji & karakter <khusus> "kutip" \u00A0nbsp \u0007 kontrol.']; d.progres.masalah = ['Kendala {bukan_tag} & lain-lain']; d.foto[0].keterangan = 'Tampak "Depan" & <Samping>'; return d; },
    '14_tanpa_luas_1pihak': d => { d.profilDasar.luasPersil = null; d.profilDasar.luasBangunan = null; d.profilDasar.pihak = d.profilDasar.pihak.slice(1); return d; },
    '15_3pihak_tanpa_nilai': d => { d.profilDasar.pihak.push({ peran: 'Konsultan Perencana', nama: 'PT. Uji Perencana', nilai: null }); return d; },
    '16_latar_sangat_panjang': d => { d.profilDasar.latarBelakang = [d.profilDasar.latarBelakang[0].repeat(4)]; return d; },
    '17_tanpa_kurvas_pra': d => { d.progres.kurvaS = null; d.profilDasar.aset.pra = null; d.profilDasar.aset.pasca = null; d.profilDasar.aset.design3d = null; return d; }
};

let fail = 0; const report = [];
for (const [name, fn] of Object.entries(scenarios)) {
    try {
        const data = fn(clone(base)); const { plan, warnings: bw } = B.buildSlidePlan(data, { manifest });
        const images = loadImages(B.imageKeys(plan));
        const r = E.render({ templateBytes: template, manifest, plan, images, env: { PizZip, DOMParser, XMLSerializer } });
        fs.writeFileSync(path.join(OUT, name + '.pptx'), Buffer.from(r.bytes));
        report.push({ name, slides: plan.length, ringkas: B.describePlan(plan), warn: bw.concat(r.warnings) });
        console.log('OK  ', name.padEnd(26), B.describePlan(plan), (bw.concat(r.warnings).length ? ' | ' + bw.concat(r.warnings).join(' ; ') : ''));
    } catch (e) { fail++; console.log('GAGAL', name, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(fail ? `\n${fail} skenario gagal` : '\nSemua skenario menghasilkan file.'); process.exit(fail ? 1 : 0);
