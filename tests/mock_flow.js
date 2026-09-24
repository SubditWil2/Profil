/* Flow tiruan "SimpanProfil": menerima POST JSON, menulis PPTX ke folder keluaran, membalas {linkBerkas}. Hanya untuk uji. */
const http = require('http'), fs = require('fs'), path = require('path');
function start(outDir, opts) {
    opts = opts || {}; fs.mkdirSync(outDir, { recursive: true }); const log = [], reads = [];
    const store = { master: {}, aset: {}, laporan: {} };          // meniru tabel ProfilKegiatan, folder _aset, dan tabel ProfilProgres
    const kk = p => p.provinsi + '|' + p.namaKegiatan;
    const cap = s => s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
    const srv = http.createServer((req, res) => {
        let body = ''; req.on('data', c => body += c); req.on('end', () => {
            setTimeout(() => {
                try {
                    if (opts.status401) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 'DirectApiAuthorizationRequired', message: 'The OAuth authorization scheme is required. Please add authentication scheme and try again.' } })); }
                    if (opts.fail) { res.writeHead(500, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: opts.fail } })); }
                    const p = JSON.parse(body); const send = o => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ body: JSON.stringify(o) })); };   // dibungkus 'body' seperti PA
                    if (req.url === '/read') {
                        reads.push(p); const m = store.master[kk(p)];
                        return send(m ? { found: true, master: m, aset: store.aset[kk(p)] || [], laporan: store.laporan[kk(p)] || [] } : { found: false });
                    }
                    log.push(p);
                    const miss = ['provinsi', 'namaKegiatan', 'targetFolderPath', 'fileName', 'pptxBase64', 'tanggalStatus', 'pic'].filter(k => !p[k]);
                    if (miss.length) { res.writeHead(400); return res.end('kolom wajib kosong: ' + miss.join(',')); }
                    fs.writeFileSync(path.join(outDir, p.fileName), Buffer.from(p.pptxBase64, 'base64'));
                    if (p.simpanMaster && p.master) {
                        const m = p.master, row = { 'Judul Profil': m.judul, 'Kode Kontrak': m.kodeKontrak, Tahun: m.tahun, 'Lokasi Singkat': m.lokasiSingkat, 'Lokasi Pekerjaan': m.lokasiPekerjaan, 'Tgl Mulai': m.tglMulai, 'Tgl Selesai': m.tglSelesai,
                            'Luas Persil': m.luasPersil, 'Luas Bangunan': m.luasBangunan, Pihak: m.pihakJson, Lingkup: m.lingkup, 'Latar Belakang': m.latarBelakang, 'Maksud Tujuan': m.maksudTujuan, 'Cap Pra': m.capPra, 'Cap Pasca': m.capPasca, 'Diubah Oleh': p.pic, 'Diubah Pada': p.timestamp };
                        store.master[kk(p)] = row;
                        const cur = (store.aset[kk(p)] || []).filter(a => !(p.aset || []).some(n => n.nama === a.nama)); store.aset[kk(p)] = cur.concat(p.aset || []);
                    }
                    (store.laporan[kk(p)] = store.laporan[kk(p)] || []).push({ 'Tanggal Status': p.tanggalStatus, 'Fisik Rencana': p.fisikRencana, 'Fisik Realisasi': p.fisikRealisasi, 'Keu Rencana': p.keuRencana, 'Keu Realisasi': p.keuRealisasi, Masalah: p.masalah, 'Tindak Lanjut': p.tindakLanjut, 'Link PPTX': 'https://contoh.sharepoint.test/' + encodeURIComponent(p.fileName) });
                    send({ linkBerkas: 'https://contoh.sharepoint.test' + p.targetFolderPath + '/' + encodeURIComponent(p.fileName), filePath: p.targetFolderPath + '/' + p.fileName });
                } catch (e) { res.writeHead(500); res.end(String(e)); }
            }, opts.delay || 0);
        });
    });
    return new Promise(r => srv.listen(0, () => { const base = 'http://127.0.0.1:' + srv.address().port; r({ url: base + '/save', readUrl: base + '/read', log, reads, store, close: () => srv.close() }); }));
}
module.exports = { start };
