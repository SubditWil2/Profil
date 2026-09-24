/* Uji halaman (data uji tertanam): muat data uji -> tempel gambar ke slot & baki -> ubah progres -> buat PPTX.
   node tests/smoke_page.js <folder_keluaran> */
const fs = require('fs'), path = require('path'), J = require('./jsdom_page.js');
const OUT = process.argv[2] || path.join(J.ROOT, 'tests', 'out'); fs.mkdirSync(OUT, { recursive: true });
const b64 = f => fs.readFileSync(f).toString('base64');
const data = JSON.parse(fs.readFileSync(path.join(J.ROOT, 'sample_data/pohuwato.json'), 'utf8'));
const files = {}; const keys = new Set(Object.values(data.profilDasar.aset)); keys.add(data.progres.kurvaS); data.foto.forEach(f => keys.add(f.file)); keys.forEach(k => files[k] = b64(path.join(J.ROOT, 'sample_data', k)));
const embed = { template: b64(path.join(J.ROOT, 'templates/Template_Profil_Kegiatan.pptx')), manifest: JSON.parse(fs.readFileSync(path.join(J.ROOT, 'templates/template_manifest.json'), 'utf8')), data, files };
(async () => {
    const { w, blobs, $, sleep } = J.load({ embed, pool: data.foto.map(f => f.file) }); let ok = true; const check = (c, m) => { console.log((c ? 'OK   ' : 'GAGAL') + ' ' + m); if (!c) ok = false; };
    $('btnSample').click(); await sleep(800);
    check(!$('cardGen').hidden && $('planBox').textContent.includes('Total 9 slide'), 'data uji termuat: ' + $('planBox').textContent);
    check($('btnLive').disabled, 'tombol "Muat dari DMS" nonaktif di halaman demo tertanam');
    [...$('chips').children].find(c => c.textContent.includes('Kurva S')).click(); let ev = J.pasteEv(w); await sleep(200); check(ev.defaultPrevented, 'Ctrl+V gambar dicegat (bukan tempel teks)');
    [...$('chips').children].find(c => c.textContent.includes('Foto lapangan')).click(); $('kelAktif').value = 'Tempel Uji';
    const n0 = w.document.querySelectorAll('.ph').length; J.pasteEv(w); await sleep(150); J.pasteEv(w); await sleep(150); J.pasteEv(w); await sleep(150);
    check(w.document.querySelectorAll('.ph').length === n0 + 3, '3 foto tertempel ke baki'); check(w.document.querySelectorAll('.dup').length > 0, 'foto kembar ditandai');
    $('fFA').value = '9.5'; $('fFA').dispatchEvent(new w.Event('input')); $('btnGen').click(); await sleep(2500);
    const big = blobs.filter(b => b.size > 1e6).pop(); check(!!big, 'PPTX dihasilkan | ' + $('genMsg').textContent.slice(0, 100));
    if (big) fs.writeFileSync(path.join(OUT, '99_halaman_jsdom.pptx'), Buffer.from(await big.arrayBuffer()));
    console.log(ok ? '\nSmoke test halaman: LOLOS' : '\nSmoke test halaman: ADA YANG GAGAL'); process.exit(ok ? 0 : 1);
})();
