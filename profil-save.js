/**
 * PROFIL-SAVE.JS — menyusun payload & memanggil flow baru "SimpanProfil" (Power Automate).
 * Pola sama dengan notulensi/ND: PPTX dibuat di browser, dikirim sebagai base64, flow hanya menyimpan file + baris Excel.
 * Spesifikasi flow: docs/FLOW_SimpanProfil.md
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'));
    else root.ProfilSave = factory(root.ProfilKit);
})(typeof self !== 'undefined' ? self : this, function (Kit) {
    const ROOT = '/SUBDIT WILAYAH 2 BPB', SUB = 'H. Profil';

    function folderProfil(provinsi, namaKegiatanFolder) {
        const prov = String(provinsi || '').trim();
        if (!prov) throw new Error('Provinsi belum dipilih.');
        if (prov === '19. Kegiatan Lainnya') throw new Error('Profil kegiatan tidak tersedia untuk "19. Kegiatan Lainnya" (bukan kegiatan fisik).');
        return `${ROOT}/${prov}/${Kit.sanitizeForPath(namaKegiatanFolder)}/${SUB}`;
    }
    /** Ringkas judul jadi <= max karakter di batas kata (deterministik; tanpa Gemini). */
    function ringkasNama(judul, max) {
        max = max || 50; let s = Kit.sanitizeForPath(judul).replace(/\s+/g, ' ').trim();
        if (s.length <= max) return s;
        s = s.slice(0, max + 1); const cut = s.lastIndexOf(' '); return (cut > 20 ? s.slice(0, cut) : s.slice(0, max)).trim();
    }
    const fileName = (tanggalStatus, judul) => `${String(tanggalStatus || '').replace(/-/g, '.')} - Profil ${ringkasNama(judul)}.pptx`;

    /** Salinan data tanpa gambar/baris mentah: cukup untuk mengisi ulang teks laporan berikutnya. */
    function snapshot(data) {
    const d = JSON.parse(JSON.stringify(data || {}));
    delete d.kronologisRaw;
    if (d.profilDasar) delete d.profilDasar.aset;
    delete d.progres.kurvaS; // Hapus referensi string statis lama
    // kurvaS (rencana, realisasi, mingguCutoff, addendum) tetap dipertahankan
    d.foto = (d.foto || []).map(f => ({ kelompok: f.kelompok || '', keterangan: f.keterangan || '', sorotan: !!f.sorotan }));
    return d;
}

    /** opts: {data, pptxBytes, jumlahSlide, kegiatanList (untuk nama folder), pic, maxPayloadMB} */
    function buildPayload(opts) {
        const d = opts.data, keg = d.kegiatan || {}, pr = d.progres || {};
        if (!keg.provinsi || !keg.namaKegiatan) throw new Error('Kegiatan belum dipilih.');
        if (!pr.tanggalStatus) throw new Error('Tanggal status belum diisi.');
        if (!opts.pic) throw new Error('Nama pembuat belum dipilih.');
        const folderKeg = Kit.resolveKegiatanFolder(keg.namaKegiatan, opts.kegiatanList || []);
        if (folderKeg !== keg.namaKegiatan) throw new Error('Kegiatan belum terdaftar di DMS. Buat dulu lewat form Notulensi/ND (folderisasi).');
        const b64 = Kit.bytesToBase64(opts.pptxBytes), asetLen = (opts.aset || []).reduce((n, a) => n + a.base64.length, 0), mb = (b64.length + asetLen) / 1048576, max = opts.maxPayloadMB || 50;
        if (mb > max) throw new Error(`Ukuran kiriman ${mb.toFixed(1)} MB melebihi batas ${max} MB. Kurangi jumlah foto atau kompres lebih kecil.`);
        const tgl = String(pr.tanggalStatus).replace(/-/g, '.'), judul = (d.profilDasar || {}).judul || keg.namaKegiatan;
        const num = x => (x === undefined || x === null || x === '') ? '' : Number(x);
        return Kit.sanitizeControlChars({
            action: 'saveProfil',
            provinsi: keg.provinsi, namaKegiatan: keg.namaKegiatan, namaKegiatanFolder: folderKeg,
            targetFolderPath: folderProfil(keg.provinsi, folderKeg), fileName: fileName(tgl, judul),
            pathPptx: folderProfil(keg.provinsi, folderKeg) + '/' + fileName(tgl, judul),   // kunci baris di Excel (satu file = satu baris)
            pptxBase64: b64,
            tanggalStatus: tgl, judul,
            fisikRencana: num((pr.fisik || {}).rencana), fisikRealisasi: num((pr.fisik || {}).realisasi),
            keuRencana: num((pr.keuangan || {}).rencana), keuRealisasi: num((pr.keuangan || {}).realisasi),
            masalah: (pr.masalah || []).join('\n'), tindakLanjut: (pr.tindakLanjut || []).join('\n'),
            jumlahFoto: (d.foto || []).length, jumlahSlide: opts.jumlahSlide || 0,
            kurvaRencanaJson: JSON.stringify(ks.rencana || (d.profilDasar && d.profilDasar.kurvaRencana) || []),
    kurvaRealisasiJson: JSON.stringify(ks.realisasi || []),
    mingguCutoff: ks.mingguCutoff || 0,
            snapshotJson: JSON.stringify(snapshot(d)),
            pic: opts.pic, timestamp: new Date().toISOString(), payloadMB: +mb.toFixed(2),
            simpanMaster: !!opts.master, master: opts.master || undefined, aset: opts.master ? (opts.aset || []) : undefined
        });
    }

    /** Mirip extractResponseData() notulensi.html: respons PA bisa terbungkus string/body. */
    function extractResponse(raw) {
        let d = raw; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { } }
        if (d && d.body) { if (typeof d.body === 'string') { try { d = JSON.parse(d.body); } catch (e) { } } else d = d.body; }
        return { link: (d && (d.linkBerkas || d.fileLink || d.LinkBerkas)) || '', path: (d && (d.filePath || d.path || d.Path)) || '', raw: d };
    }
    async function submit(url, payload, opts) {
        opts = opts || {}; const f = opts.fetchImpl || fetch; if (!url) throw new Error('saveFlowUrl belum diisi di profil-config.js (flow SimpanProfil belum dibuat).');
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const t = ctl && setTimeout(() => ctl.abort(), opts.timeoutMs || 180000);
        try {
            const res = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined });
            if (!res.ok) {
                let m = res.statusText; try { const tx = await res.text(); try { const o = JSON.parse(tx); m = (o.error && o.error.message) || o.message || tx; } catch (e) { m = tx || m; } } catch (e) { } if (res.status === 401 || res.status === 403) m = Kit.authHelp('SimpanProfil') + ' [Pesan server: ' + m + ']';
                throw new Error(`(Status ${res.status}) ${m}`);
            }
            const tx = await res.text(); const out = extractResponse(tx ? tx : {}); if (!out.link) throw new Error('Flow tidak mengembalikan linkBerkas.'); return out;
        } catch (e) { if (e && e.name === 'AbortError') throw new Error('Waktu tunggu habis saat mengirim ke server (mungkin file terlalu besar).'); throw e; }
        finally { if (t) clearTimeout(t); }
    }
    return { folderProfil, ringkasNama, fileName, snapshot, buildPayload, extractResponse, submit, SUB, ROOT };
});
