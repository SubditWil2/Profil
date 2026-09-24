/* Kriteria Fase 3: "laporan bulan kedua hanya perlu isi data periodik".
   Sesi 1: isi profil dasar + tempel gambar statis + simpan (centang default). Sesi 2 (halaman baru): profil dasar & gambar terisi dari server,
   salin dari laporan lalu, ubah angka, tempel kurva S -> PPTX lengkap, dan payload TIDAK lagi memuat master/aset. node tests/smoke_month2.js <out> */
const fs = require('fs'), path = require('path'), J = require('./jsdom_page.js'), M = require('./mock_flow.js');
const OUT = process.argv[2] || path.join(J.ROOT, 'tests', 'out');
const fx = JSON.parse(fs.readFileSync(path.join(J.ROOT, 'sample_data/getdata_fixture.json'), 'utf8')), base = JSON.parse(fs.readFileSync(path.join(J.ROOT, 'sample_data/pohuwato.json'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + m); if (!c) bad++; };
(async () => {
    const srv = await M.start(path.join(OUT, 'saved_m2'));
    const fetchStub = async (url, o) => url === 'https://dms.test/getdata' ? { ok: true, json: async () => JSON.stringify(fx) } : fetch(url, o);
    const cfg = { getDataFlowUrl: 'https://dms.test/getdata', saveFlowUrl: srv.url, readFlowUrl: srv.readUrl };
    const KEG = '02. Pembangunan Kantor Bupati Pohuwato';
    const open = async () => { const P = J.load({ fetch: fetchStub, pool: base.foto.map(f => f.file), config: cfg }); const { w, $, sleep } = P; $('btnLive').click(); await sleep(400); $('selProv').value = '05. Gorontalo'; $('selProv').dispatchEvent(new w.Event('change')); $('selKeg').value = KEG; $('btnStart').click(); await sleep(500); return P; };
    const ev = (P, id, v) => { P.$(id).value = v; P.$(id).dispatchEvent(new P.w.Event('input')); };
    const chip = (P, t) => [...P.$('chips').children].find(c => c.textContent.includes(t)).click();
    // ===== Sesi 1 =====
    let P = await open(); let { w, $, sleep } = P;
    ok(/Belum ada profil dasar/.test($('masterInfo').textContent) && $('chkMaster').checked, 'sesi 1: belum ada profil dasar -> kotak "simpan sebagai default" otomatis tercentang');
    ev(P, 'fFR', '10'); ev(P, 'fFA', '8'); ev(P, 'fKR', '20'); ev(P, 'fKA', '18'); ev(P, 'fMasalah', 'Material terlambat'); ev(P, 'fTL', 'Percepat pengadaan');
    ev(P, 'dLatar', 'Latar paragraf satu.\n\nLatar paragraf dua.'); ev(P, 'dMaksud', 'Maksud pelaksanaan.'); ev(P, 'dLingkup', 'Kantor Bupati\nPowerhouse');
    const lab = t => [...w.document.querySelectorAll('#dasarGrid label')].find(l => l.textContent.startsWith(t)).nextElementSibling; const si = (t, v) => { const i = lab(t); i.value = v; i.dispatchEvent(new w.Event('input')); };
    si('Lokasi singkat', 'Kab. Pohuwato'); si('Tanggal mulai', '2026-05-29'); si('Tanggal selesai', '2026-12-31'); si('Keterangan foto kondisi awal', 'Kondisi awal');
    const pihak = w.document.querySelectorAll('#pihakBox .pihak'); pihak[0].children[1].value = 'PT Supervisi'; pihak[0].children[1].dispatchEvent(new w.Event('input')); pihak[1].children[1].value = 'PT Pelaksana'; pihak[1].children[1].dispatchEvent(new w.Event('input'));
    for (const t of ['Gambar rencana', 'kondisi awal', 'kondisi berikutnya']) { chip(P, t); J.pasteEv(w); await sleep(200); }
    $('selPic').value = 'Teuku Zaqirul Haq'; await sleep(900); $('btnSave').click(); await sleep(3500);
    ok($('saveMsg').className === 'okbox', 'sesi 1: simpan berhasil'); const p1 = srv.log[0];
    ok(p1.simpanMaster === true && p1.aset.length === 3 && p1.master.latarBelakang.includes('paragraf dua'), 'sesi 1: payload memuat master + 3 gambar statis (' + p1.aset.map(a => a.nama).join(',') + ')');
    ok(!$('chkMaster').checked && /tersimpan sebagai default/.test($('masterInfo').textContent), 'sesi 1: setelah simpan, kotak default dilepas dan info tampil');
    // ===== Sesi 2: halaman baru, kegiatan yang sama =====
    P = await open(); ({ w, $, sleep } = P);
    ok(srv.reads.length >= 1 && /Profil dasar dimuat/.test($('masterInfo').textContent), 'sesi 2: profil dasar terbaca dari server -> ' + $('masterInfo').textContent);
    ok(!$('chkMaster').checked, 'sesi 2: kotak default tidak tercentang (profil sudah ada)');
    ok($('dLatar').value === 'Latar paragraf satu.\n\nLatar paragraf dua.' && $('dLingkup').value === 'Kantor Bupati\nPowerhouse', 'sesi 2: latar belakang & lingkup terisi persis');
    ok(w.document.querySelectorAll('#pihakBox .pihak').length === 2 && w.document.querySelectorAll('#pihakBox .pihak')[1].children[1].value === 'PT Pelaksana', 'sesi 2: pihak terisi');
    ok(w.document.querySelectorAll('#slots .slot img[src]').length >= 3 && [...w.document.querySelectorAll('#slots .slot')].filter(s => /×/.test(s.textContent)).length === 3, 'sesi 2: 3 gambar statis (rencana, awal, berikutnya) terisi dari server');
    ok(!$('btnPrev').hidden, 'sesi 2: tombol salin dari laporan sebelumnya tersedia: ' + $('btnPrev').textContent);
    ok($('fFA').value === '' && $('fMasalah').value === '', 'sesi 2: data periodik masih kosong (tidak menyalin diam-diam)');
    $('btnPrev').click(); await sleep(50);
    ok($('fFA').value === '8' && $('fMasalah').value === 'Material terlambat', 'sesi 2: klik salin -> angka & catatan laporan lalu terisi');
    ev(P, 'fTgl', '2026-09-16'); ev(P, 'fFR', '25'); ev(P, 'fFA', '21.5'); ev(P, 'fKR', '40'); ev(P, 'fKA', '35');
    chip(P, 'Kurva S'); J.pasteEv(w); await sleep(200); chip(P, 'Foto lapangan'); $('kelAktif').value = 'Gedung A1'; J.pasteEv(w); await sleep(150); J.pasteEv(w); await sleep(150);
    ok(/Latar belakang · Profil · Kurva S · Dokumentasi/.test($('planBox').textContent), 'sesi 2: rencana slide lengkap dengan HANYA data periodik yang diisi: ' + $('planBox').textContent);
    $('selPic').value = 'Muarif'; await sleep(900); $('btnSave').click(); await sleep(3500);
    const p2 = srv.log[1]; ok(p2 && p2.simpanMaster === false && p2.master === undefined && p2.aset === undefined, 'sesi 2: payload TIDAK memuat master/aset (hemat ukuran) -> ' + (p2 ? (p2.payloadMB + ' MB') : 'tidak terkirim'));
    ok(p2 && p2.tanggalStatus === '2026.09.16' && p2.fisikRealisasi === 21.5 && srv.store.laporan[Object.keys(srv.store.laporan)[0]].length === 2, 'sesi 2: baris laporan kedua tercatat (2 laporan untuk kegiatan ini)');
    // ===== Sesi 3: ganti satu gambar statis -> kotak default otomatis tercentang, aset ikut terkirim =====
    P = await open(); ({ w, $, sleep } = P);
    ok(!$('chkMaster').checked, 'sesi 3: awalnya tidak tercentang (profil sudah ada)');
    chip(P, 'kondisi awal'); J.pasteEv(w); await sleep(300);
    ok($('chkMaster').checked && /Gambar statis/.test($('masterInfo').textContent), 'sesi 3: menempel gambar statis otomatis mencentang "simpan sebagai default": ' + $('masterInfo').textContent.slice(0, 70));
    ev(P, 'fFR', '30'); ev(P, 'fFA', '25'); ev(P, 'fKR', '50'); ev(P, 'fKA', '45'); ev(P, 'fTgl', '2026-10-16'); ev(P, 'fMasalah', 'x'); ev(P, 'fTL', 'y');
    $('selPic').value = 'Muarif'; await sleep(900); $('btnSave').click(); await sleep(3500);
    const p3 = srv.log[2]; ok(p3 && p3.simpanMaster === true && p3.aset && p3.aset.length === 1 && p3.aset[0].nama === 'pra', 'sesi 3: payload memuat master + aset "pra" saja (' + (p3 && p3.aset ? p3.aset.map(a => a.nama).join(',') : 'tanpa aset') + ')');
    // mengubah teks profil dasar juga mencentang kotak
    P = await open(); ({ w, $, sleep } = P); ev(P, 'dMaksud', 'Maksud yang diubah.'); ok($('chkMaster').checked, 'sesi 4: mengubah teks profil dasar otomatis mencentang kotak default');
    srv.close(); console.log(bad ? `\n${bad} gagal` : '\nSmoke test Fase 3 (laporan bulan kedua) lolos'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
