/**
 * PROFIL-MASTER.JS — profil dasar per kegiatan (tabel Excel `ProfilKegiatan`) + aset gambar statis (`_aset/`).
 * Dibaca lewat flow BARU `BacaProfil`, ditulis lewat flow `SimpanProfil` (bagian `master` + `aset`). Spesifikasi: docs/FLOW_SimpanProfil.md
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'), require('./profil-save.js'));
    else root.ProfilMaster = factory(root.ProfilKit, root.ProfilSave);
})(typeof self !== 'undefined' ? self : this, function (Kit, PS) {
    const ASET = ['design3d', 'pra', 'pasca'];
    const lines = t => String(t || '').split('\n').map(x => x.trim()).filter(Boolean);
    const paras = t => String(t || '').split(/\n\s*\n/).map(x => x.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
    const numOrNull = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);

    /** profilDasar (state halaman) -> objek `master` untuk payload (semua teks; gambar tidak ikut). */
    function toMaster(pd) {
        pd = pd || {};
        return {
            judul: pd.judul || '', kodeKontrak: pd.kodeKontrak || '', tahun: pd.tahun == null ? '' : pd.tahun, lokasiSingkat: pd.lokasiSingkat || '', lokasiPekerjaan: pd.lokasiPekerjaan || '',
            tglMulai: pd.tglMulai || '', tglSelesai: pd.tglSelesai || '', luasPersil: pd.luasPersil == null ? '' : pd.luasPersil, luasBangunan: pd.luasBangunan == null ? '' : pd.luasBangunan,
            pihakJson: JSON.stringify((pd.pihak || []).map(p => ({ peran: p.peran || '', nama: p.nama || '', nilai: p.nilai == null ? null : p.nilai }))),
            lingkup: (pd.lingkup || []).join('\n'), latarBelakang: (pd.latarBelakang || []).join('\n\n'), maksudTujuan: (pd.maksudTujuan || []).join('\n\n'),
            capPra: pd.capPra || '', capPasca: pd.capPasca || ''
        };
    }
    /** Baris Excel `ProfilKegiatan` (nama kolom bervariasi) -> profilDasar. */
    function fromRow(row) {
        const g = (...n) => { const v = Kit.getv(row, n); return v === null || v === undefined ? '' : v; };
        let pihak = []; try { pihak = JSON.parse(g('Pihak', 'Pihak (JSON)', 'pihakJson', 'PihakJson') || '[]'); } catch (e) { }
        return {
            judul: String(g('Judul Profil', 'judul')), kodeKontrak: String(g('Kode Kontrak', 'kodeKontrak')), tahun: numOrNull(g('Tahun', 'tahun')), lokasiSingkat: String(g('Lokasi Singkat', 'lokasiSingkat')), lokasiPekerjaan: String(g('Lokasi Pekerjaan', 'lokasiPekerjaan')),
            tglMulai: String(g('Tgl Mulai', 'tglMulai')), tglSelesai: String(g('Tgl Selesai', 'tglSelesai')), luasPersil: numOrNull(g('Luas Persil', 'luasPersil')), luasBangunan: numOrNull(g('Luas Bangunan', 'luasBangunan')),
            pihak: pihak.map(p => ({ peran: p.peran || '', nama: p.nama || '', nilai: numOrNull(p.nilai) })),
            lingkup: lines(g('Lingkup', 'lingkup')), latarBelakang: paras(g('Latar Belakang', 'latarBelakang')), maksudTujuan: paras(g('Maksud Tujuan', 'Maksud dan Tujuan', 'maksudTujuan')),
            capPra: String(g('Cap Pra', 'capPra')), capPasca: String(g('Cap Pasca', 'capPasca')), aset: {}
        };
    }
    const b64ToBytes = b => { if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b, 'base64')); const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
    const pctNum = v => (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);

    /** Balasan flow BacaProfil -> {found, master, profilDasar, assets:[{nama,ext,bytes}], laporan:[...terbaru dulu]} */
    function parseRead(raw) {
        const d = PS.extractResponse(raw).raw || {};
        const jsonish = (x, fb) => { if (typeof x === 'string') { try { return JSON.parse(x); } catch (e) { return fb; } } return x === undefined || x === null ? fb : x; };   // PA sering menyisipkan objek/larik sebagai string bila dibungkus tanda kutip
        d.master = jsonish(d.master, null); d.aset = jsonish(d.aset, []); d.laporan = jsonish(d.laporan, []);
        if (!d.master || typeof d.master !== 'object' || String(d.found).toLowerCase() === 'false') return { found: false, master: null, profilDasar: null, assets: [], laporan: [] };
        const assets = (d.aset || []).filter(a => ASET.includes(a.nama) && a.base64).map(a => ({ nama: a.nama, ext: /png/i.test(a.ext || '') ? 'png' : 'jpg', bytes: b64ToBytes(a.base64) }));
        const laporan = (d.laporan || []).map(r => {
            const g = (...n) => { const v = Kit.getv(r, n); return v === null || v === undefined ? '' : v; };
            let fotoSnap = [];
            try {
                const snapRaw = g('Snapshot', 'snapshotJson', 'SnapshotJson');
                const snap = typeof snapRaw === 'string' ? JSON.parse(snapRaw || '{}') : (snapRaw || {});
                fotoSnap = Array.isArray(snap.foto) ? snap.foto.map(f => ({ kelompok: f.kelompok || '', keterangan: f.keterangan || '', sorotan: !!f.sorotan })) : [];
            } catch (e) { fotoSnap = []; }
            return {
                tanggal: String(g('Tanggal Status', 'tanggalStatus')).replace(/-/g, '.'), fisikRencana: pctNum(g('Fisik Rencana', 'fisikRencana')), fisikRealisasi: pctNum(g('Fisik Realisasi', 'fisikRealisasi')),
                keuRencana: pctNum(g('Keu Rencana', 'keuRencana')), keuRealisasi: pctNum(g('Keu Realisasi', 'keuRealisasi')), masalah: lines(g('Masalah', 'masalah')), tindakLanjut: lines(g('Tindak Lanjut', 'tindakLanjut')), link: String(g('Link PPTX', 'linkPptx')), foto: fotoSnap
            };
        }).sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        return { found: true, master: d.master, profilDasar: fromRow(d.master), assets, laporan, diubahOleh: String(Kit.getv(d.master, ['Diubah Oleh', 'diubahOleh']) || ''), diubahPada: String(Kit.getv(d.master, ['Diubah Pada', 'diubahPada']) || '') };
    }
    async function fetchProfil(url, q, opts) {
        opts = opts || {}; if (!url) return { found: false, skipped: true, assets: [], laporan: [] };
        const f = opts.fetchImpl || fetch; const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const t = ctl && setTimeout(() => ctl.abort(), opts.timeoutMs || 60000);
        try {
            const res = await f(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'bacaProfil', provinsi: q.provinsi, namaKegiatan: q.namaKegiatan, folderPath: PS.folderProfil(q.provinsi, q.namaKegiatan) }), signal: ctl ? ctl.signal : undefined });
            if (res.status === 401 || res.status === 403) throw new Error(`(Status ${res.status}) ` + Kit.authHelp('BacaProfil'));
            if (!res.ok) throw new Error(`Gagal membaca profil (HTTP ${res.status})`);
            return parseRead(await res.text());
        } catch (e) { if (e && e.name === 'AbortError') throw new Error('Waktu tunggu habis saat membaca profil kegiatan.'); throw e; } finally { if (t) clearTimeout(t); }
    }
    /** Aset baru (hanya yang belum tersimpan di server) -> [{nama, ext, base64}] */
    function assetsForSave(aset, images, isNewKey) {
        const out = []; ASET.forEach(n => { const k = aset && aset[n]; if (k && images[k] && isNewKey(k)) out.push({ nama: n, ext: images[k].ext || 'jpg', base64: Kit.bytesToBase64(images[k].data) }); }); return out;
    }
    return { ASET, toMaster, fromRow, parseRead, fetchProfil, assetsForSave, lines, paras };
});
