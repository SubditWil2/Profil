/* Uji Fase 2: adaptor data live (fixture GetMasterData) + payload + kirim ke flow tiruan. Jalankan: node tests/test_live_save.js <folder_keluaran> */
const fs = require('fs'), path = require('path'), PizZip = require('pizzip'), { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const _is = require('image-size'), sizeOf = _is.imageSize || _is.default || _is;
const ROOT = path.join(__dirname, '..'), OUT = process.argv[2] || path.join(ROOT, 'tests', 'out');
const L = require('../profil-live.js'), B = require('../profil-builders.js'), E = require('../pptx-engine.js'), S = require('../profil-save.js'), M = require('./mock_flow.js');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'templates/template_manifest.json'), 'utf8'));
const template = fs.readFileSync(path.join(ROOT, 'templates/Template_Profil_Kegiatan.pptx'));
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample_data/pohuwato.json'), 'utf8'));
const fx = JSON.parse(fs.readFileSync(path.join(ROOT, 'sample_data/getdata_fixture.json'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + m); if (!c) bad++; };
const throws = async (fn, re, m) => { try { await fn(); ok(false, m + ' (tidak melempar galat)'); } catch (e) { ok(re.test(e.message), m + ' -> ' + e.message.slice(0, 90)); } };
const loadImages = keys => { const o = {}; keys.forEach(k => { const b = fs.readFileSync(path.join(ROOT, 'sample_data', k)); const d = sizeOf(b); o[k] = { data: new Uint8Array(b), w: d.width, h: d.height, ext: 'jpg' }; }); return o; };

(async () => {
    // ---- 1. data live ----
    const store = {}; const fakeStorage = { getItem: k => store[k] || null, setItem: (k, v) => store[k] = String(v), removeItem: k => delete store[k] };
    let calls = 0; const fakeFetch = async (url, o) => { calls++; ok(JSON.parse(o.body).action === 'getData', 'POST getData dikirim'); return { ok: true, json: async () => JSON.stringify(fx) }; };   // PA sering mengembalikan string
    const m = await L.fetchMaster({ url: 'https://x', fetchImpl: fakeFetch, storage: fakeStorage });
    ok(m.provinsi.includes('05. Gorontalo') && m.provinsi.length === 4, 'provinsi terbaca: ' + m.provinsi.join(' | '));
    ok(m.kegiatanByProv['05. Gorontalo'].length === 2 && m.kegiatanByProv['08. Nusa Tenggara Barat'].length === 1, 'masterKegiatanGabungan "][" terurai (' + JSON.stringify(Object.keys(m.kegiatanByProv)) + ')');
    ok(m.geminiKeys.length === 1, 'kunci Gemini disaring (hanya GeminiAPI*)');
    await L.fetchMaster({ url: 'https://x', fetchImpl: fakeFetch, storage: fakeStorage }); ok(calls === 1, 'panggilan kedua memakai cache (fetch 1x)');
    const cands = B.kronologisCandidates(m.rows, '05. Gorontalo', '02. Pembangunan Kantor Bupati Pohuwato');
    ok(cands.length === 16, 'kandidat kronologis = 16 (pengecoh provinsi lain & bukan-kronologis tersaring): ' + cands.length);
    ok(cands[0].tanggal === '2024.04.19' && cands[0].id.includes('Dok 1'), 'tanggal ISO dinormalkan, flag "ya" huruf kecil diterima, kolom _x0020_ terbaca');
    ok(cands.every((c, i) => i === 0 || c.tanggal >= cands[i - 1].tanggal), 'urut tanggal naik');
    const rowsEx = B.kronologisRows(m.rows, '05. Gorontalo', '02. Pembangunan Kantor Bupati Pohuwato', [cands[1].id, cands[2].id]);
    ok(rowsEx.length === 14 && rowsEx[0].no === '1' && rowsEx[13].no === '14', 'pengecualian 2 baris -> 14 baris, nomor urut ulang');

    // ---- 2. render dengan data live ----
    const data = JSON.parse(JSON.stringify(base)); data.kronologisRaw = m.rows; data.kronologisExclude = [];
    const { plan } = B.buildSlidePlan(data, { manifest });
    const r = E.render({ templateBytes: template, manifest, plan, images: loadImages(B.imageKeys(plan)), env: { PizZip, DOMParser, XMLSerializer } });
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'live_render.pptx'), Buffer.from(r.bytes));
    ok(plan.filter(p => p.type === 'kronologis').length === 1 && plan.filter(p => p.type === 'kronologis')[0].groups.kron.length === 16, 'kronologis live 16 baris di 1 slide');

    // ---- 3. simpan ke flow tiruan ----
    const kegList = m.kegiatanByProv['05. Gorontalo'];
    const srv = await M.start(path.join(OUT, 'saved'));
    const payload = S.buildPayload({ data, pptxBytes: r.bytes, jumlahSlide: plan.length, kegiatanList: kegList, pic: 'Teuku Zaqirul Haq' });
    ok(payload.targetFolderPath === '/SUBDIT WILAYAH 2 BPB/05. Gorontalo/02. Pembangunan Kantor Bupati Pohuwato/H. Profil', 'path folder: ' + payload.targetFolderPath);
    ok(payload.fileName === '2026.08.16 - Profil Pembangunan Kantor Bupati Pohuwato.pptx', 'nama file: ' + payload.fileName);
    ok(payload.fisikRencana === 11.63 && payload.masalah.split('\n').length === 2 && payload.jumlahSlide === 9 && payload.jumlahFoto === 19, 'ringkasan angka/teks/jumlah terisi');
    ok(payload.pathPptx === payload.targetFolderPath + '/' + payload.fileName, 'pathPptx = folder + nama file (kunci baris Excel): ' + payload.pathPptx.slice(-70));
    const snap = JSON.parse(payload.snapshotJson); ok(!snap.kronologisRaw && !snap.profilDasar.aset && snap.foto[0].file === undefined && snap.foto.length === 19, 'snapshot tanpa gambar/baris mentah');
    const res = await S.submit(srv.url, payload); ok(/H.%20Profil|Profil/.test(res.link) && res.path.endsWith('.pptx'), 'balasan terbungkus "body" terurai -> ' + res.link.slice(0, 80));
    ok(fs.existsSync(path.join(OUT, 'saved', payload.fileName)) && fs.statSync(path.join(OUT, 'saved', payload.fileName)).size === r.bytes.length, 'file di sisi server identik dengan yang dikirim (' + (r.bytes.length / 1048576).toFixed(1) + ' MB)');

    // ---- 4. jalur galat ----
    await throws(() => S.buildPayload({ data: Object.assign({}, data, { kegiatan: { provinsi: '05. Gorontalo', namaKegiatan: '09. Kegiatan Baru' } }), pptxBytes: r.bytes, kegiatanList: kegList, pic: 'x' }), /belum terdaftar/, 'kegiatan belum terdaftar ditolak');
    await throws(() => S.buildPayload({ data: Object.assign({}, data, { kegiatan: { provinsi: '19. Kegiatan Lainnya', namaKegiatan: '01. Notulensi' } }), pptxBytes: r.bytes, kegiatanList: ['01. Notulensi'], pic: 'x' }), /19\. Kegiatan Lainnya/, 'provinsi 19 ditolak');
    await throws(() => S.buildPayload({ data, pptxBytes: r.bytes, kegiatanList: kegList, pic: '' }), /pembuat/, 'tanpa nama pembuat ditolak');
    await throws(() => S.buildPayload({ data, pptxBytes: r.bytes, kegiatanList: kegList, pic: 'x', maxPayloadMB: 1 }), /melebihi batas 1 MB/, 'payload terlalu besar ditolak sebelum dikirim');
    const s500 = await M.start(path.join(OUT, 'saved'), { fail: 'Folder tujuan tidak dapat dibuat' }); await throws(() => S.submit(s500.url, payload), /Status 500.*Folder tujuan/, 'galat server 500 memunculkan pesan flow');
    const sSlow = await M.start(path.join(OUT, 'saved'), { delay: 1500 }); await throws(() => S.submit(sSlow.url, payload, { timeoutMs: 300 }), /Waktu tunggu habis/, 'timeout ditangani');
    await throws(() => S.submit('', payload), /saveFlowUrl belum diisi/, 'URL flow kosong -> pesan jelas');
    // ---- 5. galat 401 (trigger "Any user in my tenant") ----
    const s401 = await M.start(path.join(OUT, 'saved'), { status401: true });
    await throws(() => S.submit(s401.url, payload), /Status 401.*Who can trigger the flow.*Anyone.*OAuth authorization scheme/s, 'HTTP 401 -> petunjuk mengubah trigger ke "Anyone" + pesan asli server');
    const PMd = require('../profil-master.js'); await throws(() => PMd.fetchProfil(s401.readUrl, { provinsi: 'a', namaKegiatan: 'b' }), /Status 401.*BacaProfil.*Anyone/s, 'BacaProfil 401 -> petunjuk sama');
    const Kt = require('../profil-kit.js'); const noSig = 'https://default7a697bb285cb4005b6b2f0bda687be.52.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/abc/triggers/manual/paths/invoke?api-version=1';
    ok(/Anyone/.test(Kt.flowUrlHint(noSig)), 'URL flow tanpa sig= terdeteksi sebelum dikirim'); ok(Kt.flowUrlHint(noSig + '&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=XYZ') === '' && Kt.flowUrlHint('http://127.0.0.1:1/save') === '' && Kt.flowUrlHint('') === '', 'URL ber-sig, URL lokal, dan URL kosong tidak memicu peringatan');
    srv.close(); s500.close(); sSlow.close(); s401.close();
    console.log(bad ? `\n${bad} pemeriksaan gagal` : '\nSemua pemeriksaan Fase 2 lolos'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
