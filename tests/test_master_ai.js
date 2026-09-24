/* Uji modul profil dasar (ProfilMaster) dan Rapikan AI (ProfilAI). node tests/test_master_ai.js */
const M = require('../profil-master.js'), AI = require('../profil-ai.js'), PS = require('../profil-save.js');
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + m); if (!c) bad++; };
const base = require('../sample_data/pohuwato.json');
(async () => {
    // toMaster <-> fromRow (nama kolom Excel)
    const m = M.toMaster(base.profilDasar);
    ok(m.latarBelakang.split('\n\n').length === 2 && m.lingkup.split('\n').length === 2 && JSON.parse(m.pihakJson).length === 2, 'toMaster: paragraf/poin/pihak terserialisasi');
    const row = { 'Judul Profil': m.judul, 'Kode Kontrak': m.kodeKontrak, Tahun: m.tahun, 'Lokasi_x0020_Singkat': m.lokasiSingkat, 'Lokasi Pekerjaan': m.lokasiPekerjaan, 'Tgl Mulai': m.tglMulai, 'Tgl Selesai': m.tglSelesai, 'Luas Persil': String(m.luasPersil), 'Luas Bangunan': m.luasBangunan, Pihak: m.pihakJson, Lingkup: m.lingkup, 'Latar Belakang': m.latarBelakang, 'Maksud Tujuan': m.maksudTujuan, 'Cap Pra': m.capPra, 'Cap Pasca': m.capPasca };
    const rowAlt = Object.assign({}, row, { 'Pihak (JSON)': row.Pihak, 'Maksud dan Tujuan': row['Maksud Tujuan'] }); delete rowAlt.Pihak; delete rowAlt['Maksud Tujuan'];
    const pdAlt = M.fromRow(rowAlt); ok(pdAlt.pihak.length === 2 && pdAlt.maksudTujuan.length === 1, 'fromRow: nama kolom "Pihak (JSON)" dan "Maksud dan Tujuan" (seperti tabel Excel Anda) terbaca');
    const pd = M.fromRow(row);
    ok(JSON.stringify(pd.latarBelakang) === JSON.stringify(base.profilDasar.latarBelakang) && JSON.stringify(pd.lingkup) === JSON.stringify(base.profilDasar.lingkup), 'fromRow: teks kembali identik (bolak-balik)');
    ok(pd.luasPersil === 30000 && pd.tahun === 2026 && pd.pihak[1].nilai === 37268364000 && pd.lokasiSingkat === base.profilDasar.lokasiSingkat, 'fromRow: angka jadi Number, kolom _x0020_ terbaca');
    // parseRead
    const png = Buffer.from('iVBORw0KGgo=', 'base64').toString('base64');
    const raw = JSON.stringify({ body: JSON.stringify({ found: true, master: Object.assign({ 'Diubah Oleh': 'Uji', 'Diubah Pada': '2026-08-01' }, row), aset: [{ nama: 'pra', ext: 'jpg', base64: png }, { nama: 'jahat', ext: 'jpg', base64: png }], laporan: [{ 'Tanggal Status': '2026.07.16', 'Fisik Realisasi': '5.5', Masalah: 'a\nb', 'Tindak Lanjut': 'c' }, { 'Tanggal Status': '2026.08.16', 'Fisik Rencana': 11.63, 'Fisik Realisasi': '7.68', Masalah: 'x\ny', 'Tindak Lanjut': 'z' }] }) });
    const r = M.parseRead(raw);
    ok(r.found && r.assets.length === 1 && r.assets[0].nama === 'pra', 'parseRead: aset dibatasi ke nama yang diizinkan (design3d/pra/pasca)');
    ok(r.laporan[0].tanggal === '2026.08.16' && r.laporan[0].fisikRealisasi === 7.68 && r.laporan[0].masalah.length === 2, 'parseRead: laporan terbaru di urutan pertama, teks jadi daftar');
    const rs = M.parseRead(JSON.stringify({ found: 'true', master: JSON.stringify(row), aset: JSON.stringify([{ nama: 'pra', ext: 'jpg', base64: png }]), laporan: '[]' }));
    ok(rs.found && rs.assets.length === 1 && rs.profilDasar.judul === base.profilDasar.judul, 'parseRead: master/aset berupa string JSON dan found bertipe string tetap terbaca');
    ok(!M.parseRead('').found && !M.parseRead(JSON.stringify({ found: true })).found, 'parseRead: balasan KOSONG (Response tanpa body) -> found=false; found tanpa master -> false');
    ok(!M.parseRead(JSON.stringify({ found: false })).found, 'parseRead: kegiatan tanpa profil -> found=false');
    ok((await M.fetchProfil('', { provinsi: 'a', namaKegiatan: 'b' })).skipped, 'fetchProfil tanpa URL -> dilewati (tanpa galat)');
    const sent = []; const f = async (u, o) => { sent.push(JSON.parse(o.body)); return { ok: true, text: async () => raw }; };
    const fr = await M.fetchProfil('http://x', { provinsi: 'P', namaKegiatan: 'K' }, { fetchImpl: f }); ok(fr.found && sent[0].action === 'bacaProfil' && sent[0].provinsi === 'P' && sent[0].folderPath === '/SUBDIT WILAYAH 2 BPB/P/K/H. Profil', 'fetchProfil mengirim action bacaProfil + folderPath: ' + sent[0].folderPath);
    // aset baru saja yang dikirim
    const imgs = { 'aset:pra': { data: new Uint8Array([1]), ext: 'jpg' }, 'foto:1:x': { data: new Uint8Array([2, 3]), ext: 'jpg' } };
    const as = M.assetsForSave({ pra: 'aset:pra', design3d: 'foto:1:x', pasca: null }, imgs, k => k.startsWith('foto:'));
    ok(as.length === 1 && as[0].nama === 'design3d' && as[0].base64 === 'AgM=', 'assetsForSave: hanya gambar baru (bukan yang dimuat dari server)');
    // payload master
    const data = JSON.parse(JSON.stringify(base)); const pl = PS.buildPayload({ data, pptxBytes: new Uint8Array(10), jumlahSlide: 3, kegiatanList: [data.kegiatan.namaKegiatan], pic: 'x', master: m, aset: as });
    ok(pl.simpanMaster === true && pl.master.judul === m.judul && pl.aset.length === 1, 'payload memuat master + aset'); const pl2 = PS.buildPayload({ data, pptxBytes: new Uint8Array(10), jumlahSlide: 3, kegiatanList: [data.kegiatan.namaKegiatan], pic: 'x' });
    ok(pl2.simpanMaster === false && pl2.master === undefined && pl2.aset === undefined, 'tanpa master: tidak ada bagian master/aset di payload');
    // ---- AI ----
    const gem = seq => { let i = 0; const calls = []; return { calls, fetch: async (u, o) => { const r = seq[Math.min(i++, seq.length - 1)]; calls.push(u); return r; } }; };
    const okRes = t => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
    let g = gem([{ ok: false, status: 429 }, okRes('```\n1. Pengadaan bekisting terlambat.\n- Tiang pancang tidak mencapai final set.\n```')]);
    let out = await AI.rapikan({ keys: ['K1', 'K2'], kind: 'masalah', text: 'x', fetchImpl: g.fetch });
    ok(out.text === 'Pengadaan bekisting terlambat.\nTiang pancang tidak mencapai final set.' && g.calls.length === 2 && g.calls[1].includes('key=K2'), 'AI: 429 -> pindah kunci berikutnya; markdown dan nomor dibersihkan');
    g = gem([{ ok: false, status: 503 }]); try { await AI.rapikan({ keys: ['K'], kind: 'latar', text: 'x', fetchImpl: g.fetch, models: ['m1', 'm2'] }); ok(false, 'AI semua gagal harus melempar'); } catch (e) { ok(/tidak tersedia/.test(e.message) && g.calls.length === 2, 'AI: semua model/kunci gagal -> pesan jelas (' + g.calls.length + ' percobaan)'); }
    g = gem([{ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid' } }) }]); try { await AI.rapikan({ keys: ['K'], kind: 'latar', text: 'x', fetchImpl: g.fetch }); } catch (e) { ok(/API key not valid/.test(e.message), 'AI: galat 400 diteruskan apa adanya'); }
    try { await AI.rapikan({ keys: [], kind: 'latar', text: 'x' }); } catch (e) { ok(/Kunci Gemini/.test(e.message), 'AI: tanpa kunci -> pesan jelas'); }
    ok(AI.prompt('latar', 'abc').includes('JANGAN menambah') && AI.prompt('masalah', 'abc').includes('Satu poin per baris'), 'prompt memuat larangan menambah fakta dan aturan per jenis');
    ok(AI.angkaBerubah('kedalaman 7 m, panjang 6 m', 'kedalaman 7 m, panjang 8 m') && !AI.angkaBerubah('7 m dan 6 m', 'enam... 7 m dan 6 m'), 'deteksi angka berubah pada hasil AI');
    console.log(bad ? `\n${bad} gagal` : '\nUji ProfilMaster + ProfilAI lolos'); process.exit(bad ? 1 : 0);
})();
