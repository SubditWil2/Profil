/* Uji halaman alur LIVE + SIMPAN (jsdom + flow tiruan): pilih kegiatan dari data DMS -> isi profil -> tempel gambar -> buat PPTX -> simpan ke flow tiruan.
   node tests/smoke_live.js <folder_keluaran> */
const fs = require('fs'), path = require('path'), J = require('./jsdom_page.js'), M = require('./mock_flow.js');
const OUT = process.argv[2] || path.join(J.ROOT, 'tests', 'out');
const fx = JSON.parse(fs.readFileSync(path.join(J.ROOT, 'sample_data/getdata_fixture.json'), 'utf8')), base = JSON.parse(fs.readFileSync(path.join(J.ROOT, 'sample_data/pohuwato.json'), 'utf8'));
let bad = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + m); if (!c) bad++; };
(async () => {
    const srv = await M.start(path.join(OUT, 'saved_page'));
    const fetchStub = async (url, o) => url === 'https://dms.test/getdata' ? { ok: true, json: async () => JSON.stringify(fx) } : fetch(url, o);
    const P = J.load({ fetch: fetchStub, pool: base.foto.map(f => f.file), config: { getDataFlowUrl: 'https://dms.test/getdata', saveFlowUrl: srv.url } });
    const { w, $, sleep } = P; const ev = (id, v) => { $(id).value = v; $(id).dispatchEvent(new w.Event('input')); };
    ok(!$('btnLive').disabled, 'tombol "Muat dari DMS" aktif karena getDataFlowUrl terisi');
    $('btnLive').click(); await sleep(400);
    ok(!$('livePick').hidden && $('selProv').options.length === 4, 'pemilih provinsi terisi (tanpa "19. Kegiatan Lainnya"): ' + [...$('selProv').options].map(o => o.text).join(' | '));
    $('selProv').value = '05. Gorontalo'; $('selProv').dispatchEvent(new w.Event('change'));
    ok($('selKeg').options.length === 3, 'kegiatan provinsi terpilih terisi (2 + placeholder)');
    $('selKeg').value = '02. Pembangunan Kantor Bupati Pohuwato'; $('btnStart').click(); await sleep(150);
    ok($('cardMain').hidden === false && $('planBox').textContent.includes('Kronologis'), 'profil dimulai; kronologis terisi dari data live: ' + $('planBox').textContent);
    ok($('kronInfo').textContent.startsWith('16 dari 16'), 'info kronologis: ' + $('kronInfo').textContent);
    // pengecualian 2 baris
    const cbs = w.document.querySelectorAll('#kronTable input[type=checkbox]'); cbs[3].click(); cbs[4].click(); await sleep(50);
    ok($('kronInfo').textContent.startsWith('14 dari 16'), 'centang dilepas -> ' + $('kronInfo').textContent);
    // isi profil dasar + progres
    ev('fFR', '11.63'); ev('fFA', '7.68'); ev('fKR', '20'); ev('fKA', '20'); ev('fMasalah', 'Material terlambat\nPemancangan tidak tercapai final set'); ev('fTL', 'Percepat pengadaan');
    ev('dLatar', 'Paragraf satu.\n\nParagraf dua.'); ev('dMaksud', 'Maksud pelaksanaan.'); ev('dLingkup', 'Kantor Bupati (3.147 m2)\nPowerhouse (297 m2)');
    const inputs = [...w.document.querySelectorAll('#dasarGrid input')]; const byLabel = t => [...w.document.querySelectorAll('#dasarGrid label')].find(l => l.textContent.startsWith(t)).nextElementSibling;
    const setIn = (t, v) => { const i = byLabel(t); i.value = v; i.dispatchEvent(new w.Event('input')); };
    setIn('Tanggal mulai', '2026-05-29'); setIn('Tanggal selesai', '2026-12-31'); setIn('Lokasi singkat', 'Kab. Pohuwato, Provinsi Gorontalo'); setIn('Lokasi pekerjaan', 'Kabupaten Pohuwato, Provinsi Gorontalo'); setIn('Luas persil', '30000');
    const pihak = w.document.querySelectorAll('#pihakBox .pihak'); const pi = (row, k, v) => { const i = pihak[row].children[k]; i.value = v; i.dispatchEvent(new w.Event('input')); };
    pi(0, 1, 'PT. Manggala Karya Bangun Sarana'); pi(0, 2, '1079968728'); pi(1, 1, 'PT. Cipta Adhi Guna'); pi(1, 2, '37268364000');
    // tempel kurva S dan 2 foto
    [...$('chips').children].find(c => c.textContent.includes('Kurva S')).click(); J.pasteEv(w); await sleep(200);
    [...$('chips').children].find(c => c.textContent.includes('Foto lapangan')).click(); $('kelAktif').value = 'Gedung A1'; J.pasteEv(w); await sleep(150); J.pasteEv(w); await sleep(150);
    ok(/Kurva S/.test($('planBox').textContent) && /Dokumentasi/.test($('planBox').textContent), 'rencana setelah tempel: ' + $('planBox').textContent);
    // tempel TEKS ke kolom isian tidak boleh dicegat walau clipboard juga berisi gambar (kasus salin dari PowerPoint/Word)
    const nBefore = w.document.querySelectorAll('.ph').length; const tev = new w.Event('paste', { bubbles: true, cancelable: true });
    tev.clipboardData = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => new w.File([new Uint8Array([1])], 'x.png', { type: 'image/png' }) }], types: ['text/plain', 'Files'], getData: t => t === 'text/plain' ? 'Teks latar belakang' : '' };
    $('dLatar').dispatchEvent(tev); await sleep(150);
    ok(!tev.defaultPrevented && w.document.querySelectorAll('.ph').length === nBefore, 'tempel teks di kolom latar belakang TIDAK dicegat (tidak ada foto baru)');
    const iev = J.pasteEv(w); ok(iev.defaultPrevented, 'tempel gambar-saja tetap ditangkap sebagai foto'); await sleep(150);
    // unduh lokal
    $('btnGen').click(); await sleep(2500);
    ok(/✓ \d+ slide/.test($('genMsg').textContent), 'PPTX lokal dibuat: ' + $('genMsg').textContent.slice(0, 70));
    // simpan
    await sleep(900); ok($('btnSave').disabled === false, 'tombol Simpan aktif (flow terkonfigurasi + data DMS termuat)');
    $('selPic').value = 'Teuku Zaqirul Haq'; $('btnSave').click(); await sleep(3500);
    ok($('saveMsg').className === 'okbox' && $('saveMsg').textContent.includes('Tersimpan'), 'simpan berhasil: ' + $('saveMsg').textContent.slice(0, 60));
    const f = path.join(OUT, 'saved_page', '2026.' + new Date().toISOString().slice(5, 7) + '.' + new Date().toISOString().slice(8, 10) + ' - Profil Pembangunan Kantor Bupati Pohuwato.pptx');
    const saved = fs.readdirSync(path.join(OUT, 'saved_page')); ok(saved.length >= 1 && srv.log.length === 1, 'file diterima flow tiruan: ' + saved.join(', ') + ' | payload: ' + srv.log[0].targetFolderPath.split('/').slice(-3).join('/') + ' | ' + srv.log[0].jumlahSlide + ' slide');
    ok(srv.log[0].pic === 'Teuku Zaqirul Haq' && srv.log[0].fisikRealisasi === 7.68 && JSON.parse(srv.log[0].snapshotJson).kronologisExclude.length === 2, 'isi payload: pembuat, angka, pengecualian kronologis (2) ikut tersimpan di snapshot');
    // tombol simpan tidak aktif tanpa data DMS (mode data uji)
    const Q = J.load({ fetch: fetchStub, pool: [], config: { saveFlowUrl: srv.url } }); Q.$('btnSample').click(); await Q.sleep(1800);
    ok(Q.$('btnSave').disabled && /Muat data dari DMS/.test(Q.$('saveHint').textContent), 'mode data uji: Simpan nonaktif dengan alasan -> ' + Q.$('saveHint').textContent);
    const R = J.load({ fetch: fetchStub, pool: [], config: { saveFlowUrl: '' } }); R.$('btnSample').click(); await R.sleep(1800);
    ok(R.$('btnSave').disabled && /belum dikonfigurasi/.test(R.$('saveHint').textContent), 'flow belum dikonfigurasi: Simpan nonaktif -> ' + R.$('saveHint').textContent);
    srv.close(); console.log(bad ? `\n${bad} gagal` : '\nSmoke test LIVE + SIMPAN lolos'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
