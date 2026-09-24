/**
 * PROFIL-BUILDERS.JS — logika bisnis Profil Kegiatan: data -> "slide plan".
 * Tidak menyentuh PPTX dan tidak butuh DOM; bisa diuji di Node.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'));
    else root.ProfilBuilders = factory(root.ProfilKit);
})(typeof self !== 'undefined' ? self : this, function (Kit) {

    // ---------- 1. nilai tag dari data ----------
    const YA = v => ['ya', 'true', '1'].includes(String(v === null || v === undefined ? '' : v).trim().toLowerCase());
    const tglNorm = t => { t = String(t || '').trim(); return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10).replace(/-/g, '.') : t; };
    /** Semua dokumen bertanda kronologis untuk kegiatan (Provinsi + Nama Kegiatan), urut tanggal, memuat id stabil. */
    function kronologisCandidates(raw, provinsi, kegiatan) {
        const g = Kit.getv;
        const rows = (raw || []).map((r, i) => ({ r, i })).filter(({ r }) =>
            String(g(r, ['Provinsi', 'provinsi']) || '').trim() === provinsi && String(g(r, ['Nama Kegiatan', 'namaKegiatan', 'NamaKegiatan']) || '').trim() === kegiatan &&
            YA(g(r, ['IsKronologis', 'isKronologis', 'Is Kronologis', 'Is_Kronologis'])));
        const out = rows.map(({ r, i }) => {
            const tanggal = tglNorm(g(r, ['Tanggal', 'tanggal', 'Tanggal Rapat', 'tanggalRapat'])), uraian = g(r, ['Perihal', 'perihal', 'Judul Rapat', 'judulRapat']) || '';
            const nomor = g(r, ['Nomor Surat', 'nomorSurat', 'NomorSurat']) || '';
            return { i, id: g(r, ['Path ND - Surat', 'pathNDSurat', 'pathND']) || `${tanggal}|${nomor}|${uraian}`, tanggal, uraian: String(uraian), nomor: String(nomor),
                     dari: String(g(r, ['AlurDari', 'alurDari', 'Alur Dari']) || ''), ke: String(g(r, ['AlurKe', 'alurKe', 'Alur Ke']) || '') };
        });
        out.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.i - b.i);
        return out;
    }
    /** Baris final (kandidat dikurangi yang dikecualikan) bernomor urut. */
    function kronologisRows(raw, provinsi, kegiatan, excludeIds) {
        const ex = new Set(excludeIds || []);
        return kronologisCandidates(raw, provinsi, kegiatan).filter(r => !ex.has(r.id)).map((r, k) => ({ no: String(k + 1), tanggal: r.tanggal, uraian: r.uraian, nomor: r.nomor, dari: r.dari, ke: r.ke }));
    }

    function valuesOf(data) {
        const pd = data.profilDasar || {}, pr = data.progres || {}, keg = data.kegiatan || {};
        const fis = pr.fisik || {}, keu = pr.keuangan || {};
        const ks = data.kurvaS || {};

        // 1. Hitung minggu jadwal dan minggu cutoff aktif
        const { totalWeeks } = Kit.calcScheduleWeeks(pd.tglMulai, pd.tglSelesai);
        const cutoffWeek = Kit.calcCutoffWeek(pd.tglMulai, pr.tanggalStatus, totalWeeks);

        // 2. Ambil nilai Fisik Rencana & Realisasi dari Matriks Kurva S (jika ada)
        const rncList = ks.rencana || [];
        const rlsList = ks.realisasi || [];
        const fisRnc = (rncList[cutoffWeek - 1] !== undefined) ? rncList[cutoffWeek - 1] : fis.rencana;
        const fisRls = (rlsList[cutoffWeek - 1] !== undefined) ? rlsList[cutoffWeek - 1] : fis.realisasi;

        const dev = (r, a) => (a === undefined || r === undefined || a === null || r === null) ? '' : Kit.fmtAngka(Number(a) - Number(r), 2);
        const hari = (pd.tglMulai && pd.tglSelesai) ? Kit.hariInklusif(pd.tglMulai, pd.tglSelesai) : null;

        const values = {
            judul_kegiatan: String(pd.judul || '').toUpperCase(), lokasi: pd.lokasiSingkat || '',
            kode_kontrak: pd.kodeKontrak || '', label_program: [pd.kodeKontrak, pd.tahun].filter(Boolean).join(' '),
            tanggal_cover: Kit.fmtTanggal(pr.tanggalStatus), tanggal_status: Kit.fmtTanggal(pr.tanggalStatus),
            nama_pekerjaan: pd.judul || '', lokasi_pekerjaan: pd.lokasiPekerjaan || pd.lokasiSingkat || '',
            masa_pelaksanaan: hari ? `${hari} Hari Kalender (${Kit.fmtTanggal(pd.tglMulai, { pad: false })} – ${Kit.fmtTanggal(pd.tglSelesai)})` : '',
            luas_persil: pd.luasPersil ? `${Kit.fmtAngka(pd.luasPersil)} m2` : '', luas_bangunan: pd.luasBangunan ? `${Kit.fmtAngka(pd.luasBangunan)} m2` : '',
            cap_pra: pd.aset && pd.aset.pra ? (pd.capPra || '') : '', cap_pasca: pd.aset && pd.aset.pasca ? (pd.capPasca || '') : '',
            // Angka Fisik otomatis terhubung dengan Matriks Kurva S:
            fisik_rencana: Kit.fmtAngka(fisRnc, 2), 
            fisik_realisasi: Kit.fmtAngka(fisRls, 2), 
            fisik_deviasi: dev(fisRnc, fisRls),
            keu_rencana: Kit.fmtAngka(keu.rencana, 2), 
            keu_realisasi: Kit.fmtAngka(keu.realisasi, 2), 
            keu_deviasi: dev(keu.rencana, keu.realisasi)
        };
        const lists = {
            latar_belakang: pd.latarBelakang || [], maksud_tujuan: pd.maksudTujuan || [], lingkup: pd.lingkup || [],
            masalah: pr.masalah || [], tindak_lanjut: pr.tindakLanjut || []
        };
        const groups = {
            pihak: (pd.pihak || []).map(p => ({ peran: p.peran || '', nama: p.nama || '', nilai: Kit.fmtRupiah(p.nilai) })),
            kron: kronologisRows(data.kronologisRaw, keg.provinsi, keg.namaKegiatan, data.kronologisExclude)
        };
        return Kit.sanitizeControlChars({ values, lists, groups });
    }
        const lists = {
            latar_belakang: pd.latarBelakang || [], maksud_tujuan: pd.maksudTujuan || [], lingkup: pd.lingkup || [],
            masalah: pr.masalah || [], tindak_lanjut: pr.tindakLanjut || []
        };
        const groups = {
            pihak: (pd.pihak || []).map(p => ({ peran: p.peran || '', nama: p.nama || '', nilai: Kit.fmtRupiah(p.nilai) })),
            kron: kronologisRows(data.kronologisRaw, keg.provinsi, keg.namaKegiatan, data.kronologisExclude)
        };
        return Kit.sanitizeControlChars({ values, lists, groups });
    }

    // ---------- 2. pagination kronologis (baris bervariasi tingginya) ----------
    const DEFAULT_KRON = { colWidthsEmu: [360000, 1100000, 3880000, 1900000, 2080000, 2272000], fontPt: 9, cellMarginEmu: [72000, 72000, 22000, 22000], minRowEmu: 300000, headerEmu: 300000, topEmu: 850000, bottomEmu: 6450000 };

    function kronRowHeight(row, h) {
        const cols = [row.no, row.tanggal, row.uraian, row.nomor, row.dari, row.ke];
        const [mL, mR, mT, mB] = h.cellMarginEmu; const lineH = h.fontPt * 1.15 * 12700; let maxL = 1;
        cols.forEach((t, i) => { maxL = Math.max(maxL, Kit.wrapLineCount(t, h.colWidthsEmu[i] - mL - mR, h.fontPt, false)); });
        return Math.max(h.minRowEmu, Math.round(maxL * lineH + mT + mB + 12700));
    }
    /** Bagi baris menjadi halaman yang tingginya MERATA (bukan 16+4). */
    function paginateKron(rows, hints) {
        const h = Object.assign({}, DEFAULT_KRON, hints || {});
        if (!rows.length) return [];
        const hs = rows.map(r => kronRowHeight(r, h));
        const cap = Math.floor((h.bottomEmu - h.topEmu - h.headerEmu) * 0.97);
        const pack = limit => { const pages = []; let cur = [], sum = 0; hs.forEach((x, i) => { if (cur.length && sum + x > limit) { pages.push(cur); cur = []; sum = 0; } cur.push(i); sum += x; }); pages.push(cur); return pages; };
        const base = pack(cap); const P = base.length; let best = base;
        if (P > 1) {
            let lo = Math.max(Math.max(...hs), Math.floor(hs.reduce((a, b) => a + b, 0) / P)), hi = cap;
            while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (pack(mid).length <= P) hi = mid; else lo = mid + 1; }
            best = pack(lo);
        }
        return best.map(idx => ({ rows: idx.map(i => rows[i]), heights: idx.map(i => hs[i]) }));
    }

    // ---------- 3. pembagian foto dokumentasi ----------
    /** Maks `max` foto per slide, dibagi merata (13 -> 5/4/4), pemutusan digeser +-1 ke batas kelompok bila memungkinkan. */
    function splitDokumentasi(photos, max) {
        max = max || 6; const n = photos.length; if (!n) return [];
        const pages = Math.ceil(n / max); const bounds = [0];
        const avg = n / pages, lo = Math.max(1, Math.ceil(avg - 1)), hi = Math.min(max, Math.floor(avg + 1));   // ukuran antar-slide dijaga dalam +-1 dari rata-rata
        const isBreak = c => c >= n || (photos[c - 1] && photos[c] && (photos[c - 1].kelompok || '') !== (photos[c].kelompok || ''));
        for (let i = 0; i < pages - 1; i++) {
            const prev = bounds[i], remItems = n - prev, remPages = pages - i;
            const ideal = Math.round(remItems / remPages); let pick = null;
            const feasible = size => size >= lo && size <= hi && (n - prev - size) >= (remPages - 1) * lo && (n - prev - size) <= (remPages - 1) * hi;
            for (const size of [ideal, ideal - 1, ideal + 1]) {           // ideal diutamakan, lalu +-1 bila jatuh di batas kelompok
                if (!feasible(size)) continue;
                if (size === ideal && pick === null) pick = prev + size;
                if (isBreak(prev + size)) { if (size === ideal || !isBreak(pick)) pick = prev + size; break; }
            }
            bounds.push(pick === null ? prev + Math.min(max, Math.max(1, ideal)) : pick);
        }
        bounds.push(n);
        return bounds.slice(0, -1).map((b, i) => photos.slice(b, bounds[i + 1]));
    }

    // ---------- 4. slide plan ----------
    const capOf = p => [p.kelompok, p.keterangan].filter(x => x && String(x).trim()).join(' – ');

    function buildSlidePlan(data, opts) {
        opts = opts || {}; const warnings = [];
        const { values, lists, groups } = valuesOf(data);
        const pd = data.profilDasar || {}, pr = data.progres || {}, aset = pd.aset || {};
        const manifestHints = opts.manifest && opts.manifest.layoutHints && opts.manifest.layoutHints.kronologis;
        const maxSorotan = (opts.manifest && opts.manifest.rules && opts.manifest.rules.maxPhotosPerSlide && opts.manifest.rules.maxPhotosPerSlide.profil) || 6;
        const maxDok = (opts.manifest && opts.manifest.rules && opts.manifest.rules.maxPhotosPerSlide && opts.manifest.rules.maxPhotosPerSlide.dokumentasi) || 6;
        const plan = [];
        const photo = p => ({ key: p.file, caption: capOf(p) });

        plan.push({ type: 'cover', values, lists: {}, groups: {} });

        const kron = paginateKron(groups.kron, manifestHints);
        kron.forEach(pg => plan.push({ type: 'kronologis', values, lists: {}, groups: { kron: pg.rows }, rowHeights: pg.heights }));
        if (!kron.length) warnings.push('Kronologis kosong: slide dilewati (tidak ada dokumen bertanda kronologis untuk kegiatan ini).');
        else {
            const tanpaNomor = groups.kron.filter(r => !r.nomor).length;
            if (tanpaNomor) warnings.push(`${tanpaNomor} baris kronologis tanpa nomor surat.`);
        }

        if ((lists.latar_belakang.length || lists.maksud_tujuan.length))
            plan.push({ type: 'latar', values, lists, groups: {}, images: { pra: aset.pra, pasca: aset.pasca } });

        const all = (data.foto || []).filter(p => p && p.file);
        let sorotan = all.filter(p => p.sorotan);
        if (sorotan.length > maxSorotan) { warnings.push(`${sorotan.length} foto bertanda sorotan; hanya ${maxSorotan} pertama yang dipakai di slide profil.`); sorotan = sorotan.slice(0, maxSorotan); }
        plan.push({ type: 'profil', values, lists, groups: { pihak: groups.pihak }, images: { design3d: aset.design3d }, photos: sorotan.map(photo) });

        if (pr.kurvaS) plan.push({ type: 'kurvas', values, lists: {}, groups: {}, images: { kurvas: pr.kurvaS } });
        else warnings.push('Kurva S belum diunggah: slide dilewati.');

        const usedSorotan = new Set(sorotan);
        const dok = all.filter(p => opts.sorotanDiDokumentasi ? true : !p.sorotan || !usedSorotan.has(p));
        splitDokumentasi(dok, maxDok).forEach(pg => plan.push({ type: 'dokumentasi', values, lists: {}, groups: {}, photos: pg.map(photo) }));
        if (!dok.length) warnings.push('Tidak ada foto dokumentasi: slide dokumentasi dilewati.');

        plan.push({ type: 'terimakasih', values, lists: {}, groups: {} });
        return { plan, warnings };
    }

    /** Ringkasan teks: 'Cover · Kronologis (2) · ...' */
    function describePlan(plan) {
        const NAMA = { cover: 'Cover', kronologis: 'Kronologis', latar: 'Latar belakang', profil: 'Profil', kurvas: 'Kurva S', dokumentasi: 'Dokumentasi', terimakasih: 'Terima kasih' };
        const out = []; let i = 0;
        while (i < plan.length) {
            let j = i; while (j + 1 < plan.length && plan[j + 1].type === plan[i].type) j++;
            const cnt = j - i + 1; let label = NAMA[plan[i].type];
            if (cnt > 1 || plan[i].type === 'dokumentasi') label += ` (${cnt}${plan[i].type === 'dokumentasi' ? ': ' + plan.slice(i, j + 1).map(p => p.photos.length).join('/') : ''})`;
            out.push(label); i = j + 1;
        }
        return `Total ${plan.length} slide: ` + out.join(' · ');
    }

    /** Semua kunci gambar yang harus dimuat sebelum render. */
    function imageKeys(plan) {
        const s = new Set();
        plan.forEach(p => { Object.values(p.images || {}).forEach(k => k && s.add(k)); (p.photos || []).forEach(x => s.add(x.key)); });
        return [...s];
    }

    return { valuesOf, kronologisCandidates, kronologisRows, paginateKron, splitDokumentasi, buildSlidePlan, describePlan, imageKeys, capOf };
});
