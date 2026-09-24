/**
 * PROFIL-KIT.JS — helper mandiri untuk fitur Profil Kegiatan (Fase 1).
 * SALINAN/TURUNAN dari dms-shared.js supaya fitur ini tidak menyentuh file produksi.
 * Saat integrasi, bagian yang berasal dari dms-shared.js (sanitizeControlChars, format tanggal)
 * diganti pemanggilan aslinya. Semua fungsi ada di namespace ProfilKit (bukan global).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.ProfilKit = factory();
})(typeof self !== 'undefined' ? self : this, function () {

    const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    /** 'YYYY.MM.DD' | 'YYYY-MM-DD' | 'YYYY/MM/DD' -> {y,m,d} atau null */
    function parseTgl(s) {
        const m = String(s || '').trim().match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})$/);
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
    }
    /** Turunan formatTanggalIndonesia() di dms-shared.js. Contoh: '2026.08.16' -> '16 Agustus 2026' */
    function fmtTanggal(s, opt) {
        const t = parseTgl(s); if (!t) return String(s || '');
        const pad = !(opt && opt.pad === false);
        return `${pad ? String(t.d).padStart(2, '0') : t.d} ${BULAN[t.m - 1]} ${t.y}`;
    }
    /** Selisih hari kalender INKLUSIF (29 Mei..31 Des 2026 = 217). */
    function hariInklusif(a, b) {
        const A = parseTgl(a), B = parseTgl(b); if (!A || !B) return null;
        return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000) + 1;
    }
    /** Format angka Indonesia: titik ribuan, koma desimal. */
    function fmtAngka(n, dec) {
        if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '';
        dec = dec || 0; const num = Number(n); const s = Math.abs(num).toFixed(dec);
        let [i, f] = s.split('.'); i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        const neg = num < 0 && parseFloat(s) !== 0;
        return (neg ? '-' : '') + i + (f ? ',' + f : '');
    }
    const fmtRupiah = n => (n === null || n === undefined || n === '' || isNaN(Number(n))) ? '' : 'Rp. ' + fmtAngka(n, 0);

    /** Salinan sanitizeControlChars() dms-shared.js (karakter kontrol ilegal XML). */
    function sanitizeControlChars(obj) {
        if (typeof obj === 'string') return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\u00A0/g, ' ');
        if (Array.isArray(obj)) return obj.map(sanitizeControlChars);
        if (obj && typeof obj === 'object') { const o = {}; for (const [k, v] of Object.entries(obj)) o[k] = sanitizeControlChars(v); return o; }
        return obj;
    }


    // ---------- turunan dms-shared.js: nama kolom fleksibel & path ----------
    const normKey = k => String(k).toLowerCase().replace(/_x0020_|[\s_]/g, '');   // '_x0020_' harus dicoba dulu (di dms-shared urutannya terbalik sehingga variannya tidak pernah cocok)
    /** Turunan dapatkanNilaiKolom(): baca kolom Excel dengan variasi nama (spasi/underscore/_x0020_). */
    function getv(row, names) {
        if (!row) return null;
        for (const n of names) if (row[n] !== undefined && row[n] !== null) return row[n];
        const want = names.map(normKey);
        for (const k of Object.keys(row)) if (want.includes(normKey(k))) return row[k];
        return null;
    }
    /** Turunan sanitizeForPath() dms-shared.js. */
    function sanitizeForPath(str) {
        if (!str) return '';
        return String(str).trim().replace(/\//g, '-').replace(/\\/g, '-').replace(/:/g, '-').replace(/"/g, '').replace(/\?/g, '').replace(/\*/g, '').replace(/</g, '').replace(/>/g, '').replace(/\|/g, '');
    }
    /** Turunan resolveKegiatanFolder(): nama kegiatan yang sudah terdaftar dipakai apa adanya; yang baru diberi nomor urut berikutnya. */
    function resolveKegiatanFolder(input, existing) {
        input = String(input || '').trim(); const list = Array.isArray(existing) ? existing : [];
        if (list.some(n => String(n || '').trim() === input)) return input;
        const RE = /^\s*(\d+)\s*[.)]\s*(.*)$/; const m = input.match(RE); const bersih = m ? m[2].trim() : input;
        let max = 0, width = 2; list.forEach(n => { const x = String(n || '').trim().match(RE); if (x && +x[1] > max) { max = +x[1]; width = x[1].length; } });
        return `${String(max + 1).padStart(width, '0')}. ${bersih}`;
    }
    function bytesToBase64(u8) {
        if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
        let s = ''; const CH = 0x8000; for (let i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s);
    }

    // ---------- diagnosis URL/autentikasi flow Power Automate ----------
    /** Trigger HTTP yang diset "Any user in my tenant" menghasilkan URL TANPA `sig=` dan menolak panggilan browser dengan 401. */
    function flowUrlHint(url) {
        if (!url) return '';
        try {
            const u = new URL(url);
            if (/powerplatform\.com|logic\.azure\.com|azure-apim\.net/.test(u.hostname) && !u.searchParams.get('sig'))
                return 'URL flow tidak memuat "sig=". Kemungkinan trigger HTTP diset "Any user in my tenant" (butuh login Microsoft, browser akan ditolak 401). Ubah "Who can trigger the flow?" menjadi "Anyone", simpan flow, lalu salin ulang URL lengkapnya.';
        } catch (e) { }
        return '';
    }
    function authHelp(namaFlow) {
        return `Flow ${namaFlow} menuntut autentikasi Microsoft. Buka flow → trigger "When an HTTP request is received" → "Who can trigger the flow?" → pilih "Anyone" → simpan, lalu salin ulang URL (harus memuat "sig=") ke profil-config.js.`;
    }

    // ---------- Estimasi lebar teks (Arial/Liberation Sans, satuan em) ----------
    const EM = {};
    const setEm = (chars, w) => { for (const c of chars) EM[c] = w; };
    setEm('ijl', 0.222); setEm("'|", 0.22); setEm('.,;:!', 0.278); setEm('tf ', 0.278); setEm('r', 0.333); setEm('I', 0.278); setEm('()[]-', 0.333);
    setEm('abdeghnopqu', 0.556); setEm('csvxyzk', 0.5); setEm('m', 0.833); setEm('w', 0.722);
    setEm('0123456789', 0.556); setEm('/', 0.278); setEm('–—', 0.556); setEm('&', 0.667); setEm('+=<>', 0.584); setEm('%', 0.889);
    setEm('ABCDEHKNRSUVXY', 0.69); setEm('FLTZ', 0.62); setEm('GOQD', 0.78); setEm('M', 0.83); setEm('W', 0.94); setEm('J', 0.5); setEm('P', 0.667);
    const charEm = c => EM[c] !== undefined ? EM[c] : (c >= 'A' && c <= 'Z' ? 0.69 : 0.55);
    function textWidthEmu(text, pt, bold) {
        let em = 0; for (const c of String(text)) em += charEm(c);
        return em * pt * 12700 * (bold ? 1.07 : 1);
    }
    /** Jumlah baris hasil word-wrap greedy pada lebar tertentu (EMU). */
    function wrapLineCount(text, widthEmu, pt, bold) {
        let lines = 0;
        for (const para of String(text || '').split('\n')) {
            const words = para.split(/\s+/).filter(Boolean);
            if (!words.length) { lines += 1; continue; }
            let cur = 0, n = 1; const space = textWidthEmu(' ', pt, bold);
            for (const w of words) {
                const ww = textWidthEmu(w, pt, bold);
                if (cur === 0) { cur = ww; }
                else if (cur + space + ww <= widthEmu) { cur += space + ww; }
                else { n++; cur = ww; }
                while (cur > widthEmu) { n++; cur -= widthEmu; }   // kata sangat panjang dipatah
            }
            lines += n;
        }
        return lines;
    }

    // ---------- Persiapan foto (HANYA browser) ----------
    /** File/Blob gambar -> {data:Uint8Array, w, h, ext:'jpg'}; sisi terpanjang <= maxEdge, JPEG kualitas q. Orientasi EXIF diterapkan. */
    async function prepareImageFile(file, maxEdge, q) {
        maxEdge = maxEdge || 1600; q = q || 0.82;
        let bmp;
        if (typeof createImageBitmap === 'function') {
            try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = await createImageBitmap(file); }
        } else {
            bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
        }
        const sw = bmp.width || bmp.naturalWidth, sh = bmp.height || bmp.naturalHeight;
        const k = Math.min(1, maxEdge / Math.max(sw, sh)); const w = Math.round(sw * k), h = Math.round(sh * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h);
        if (bmp.close) bmp.close();
        const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q));
        const data = new Uint8Array(await blob.arrayBuffer());
        cv.width = cv.height = 0;    // lepas memori (penting di HP)
        return { data, w, h, ext: 'jpg' };
    }

/**
 * Menghitung jumlah minggu kalender (kelipatan 7 hari inklusif).
 */
function calcScheduleWeeks(tglMulai, tglSelesai) {
    const days = hariInklusif(tglMulai, tglSelesai);
    if (!days || days <= 0) return { totalWeeks: 0, days: 0 };
    const totalWeeks = Math.ceil(days / 7);
    return { totalWeeks, days };
}

/**
 * Menghitung minggu ke-berapa suatu tanggal cut-off berada.
 */
function calcCutoffWeek(tglMulai, tglStatus, totalWeeks) {
    const daysElapsed = hariInklusif(tglMulai, tglStatus);
    if (!daysElapsed) return 1;
    const week = Math.ceil(daysElapsed / 7);
    if (!totalWeeks || totalWeeks <= 0) return Math.max(1, week);
    return Math.min(Math.max(week, 1), totalWeeks);
}

/**
 * Parser deret angka persentase dari copy-paste teks Excel (tab, baris baru, koma).
 */
function parseNumberSeries(rawText) {
    if (!rawText) return [];
    if (Array.isArray(rawText)) return rawText.map(n => Number(n)).filter(n => !isNaN(n));
    const tokens = String(rawText)
        .replace(/%/g, '')
        .replace(/\r\n/g, '\n')
        .split(/[\t\n;, ]+/)
        .map(s => s.trim())
        .filter(Boolean);

    const result = [];
    for (const token of tokens) {
        const clean = token.includes(',') && !token.includes('.') ? token.replace(',', '.') : token;
        const num = parseFloat(clean);
        if (!isNaN(num)) result.push(num);
    }
    return result;
}

/**
 * Konversi URL sharing SharePoint/OneDrive menjadi URL Slideshow Embed untuk iframe.
 */
function toEmbedPptxUrl(url) {
    if (!url) return '';
    try {
        const u = new URL(url.trim());
        if (u.hostname.includes('sharepoint.com') || u.hostname.includes('1drv.ms')) {
            u.searchParams.set('action', 'embedview');
            u.searchParams.delete('e');
            return u.toString();
        }
    } catch (e) {
        if (url.includes('?')) return url + '&action=embedview';
        return url + '?action=embedview';
    }
    return url;
}

/**
 * Menggambar Kurva S terintegrasi (Grafik + Matriks Tabel Sumbu X) ke Canvas HTML5.
 */
function renderKurvaSCanvas(canvas, opts) {
    const W = opts.width || 1920, H = opts.height || 1080;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    const rencana = opts.rencana || [];
    const realisasi = opts.realisasi || [];
    const totalWeeks = Math.max(rencana.length, 1);
    const cutoffWeek = opts.cutoffWeek || realisasi.length || 1;
    const lastIdx = Math.min(cutoffWeek - 1, realisasi.length - 1);

    const padL = 60, padR = 60, lblW = 280;
    const chartT = 90, chartB = 680, chartH = chartB - chartT;
    const tblT = 720, rowH = 75;
    const dataW = W - padL - padR - lblW;
    const colW = dataW / totalWeeks;

    const getX = i => padL + lblW + (i + 0.5) * colW;
    const getY = val => chartT + chartH - (Math.max(0, Math.min(val, 100)) / 100.0) * chartH;

    // Background Putih
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 1. Grid Garis Horizontal (0%, 25%, 50%, 75%, 100%)
    ctx.font = '500 22px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;

    for (let pct = 0; pct <= 100; pct += 25) {
        const y = getY(pct);
        ctx.beginPath();
        ctx.moveTo(padL + lblW, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.fillText(pct + '%', padL + lblW - 18, y);
    }

    // Grid Vertikal halus
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    for (let i = 0; i < totalWeeks; i++) {
        const x = getX(i);
        ctx.beginPath(); ctx.moveTo(x, chartT); ctx.lineTo(x, chartB); ctx.stroke();
    }

    // 2. Garis Rencana Kumulatif (Navy #152e4d)
    if (rencana.length > 0) {
        ctx.strokeStyle = '#152e4d';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        rencana.forEach((v, i) => {
            const x = getX(i), y = getY(v);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    // 3. Garis Realisasi (Merah #ef4444)
    if (realisasi.length > 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        for (let i = 0; i <= lastIdx; i++) {
            const x = getX(i), y = getY(realisasi[i]);
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        for (let i = 0; i <= lastIdx; i++) {
            const x = getX(i), y = getY(realisasi[i]);
            ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Highlight Titik Terakhir Realisasi
    if (lastIdx >= 0 && realisasi[lastIdx] !== undefined) {
        const px = getX(lastIdx), py = getY(realisasi[lastIdx]);
        ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444'; ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    }

    // 4. Tabel Matriks Mingguan di Sisi Bawah
    const rows = [
        { label: "Minggu ke-", hdrBg: "#0c1c30", cellBg: "#f1f5f9", hdrFg: "#f59e0b", cellFg: "#0f172a" },
        { label: "Rencana Kum. (%)", hdrBg: "#152e4d", cellBg: "#ffffff", hdrFg: "#ffffff", cellFg: "#334155" },
        { label: "Realisasi Kum. (%)", hdrBg: "#152e4d", cellBg: "#f8fafc", hdrFg: "#ffffff", cellFg: "#0f172a" },
        { label: "Deviasi (%)", hdrBg: "#152e4d", cellBg: "#ffffff", hdrFg: "#ffffff", cellFg: "#334155" }
    ];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 18px "JetBrains Mono", monospace';

    rows.forEach((r, rIdx) => {
        const ry = tblT + rIdx * rowH;
        // Header Kolom Label Kiri
        ctx.fillStyle = r.hdrBg;
        ctx.fillRect(padL, ry, lblW, rowH);
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
        ctx.strokeRect(padL, ry, lblW, rowH);

        ctx.fillStyle = r.hdrFg;
        ctx.textAlign = 'left';
        ctx.font = '700 20px "Plus Jakarta Sans", Arial, sans-serif';
        ctx.fillText(r.label, padL + 18, ry + rowH / 2);

        // Sel Nilai Tiap Minggu
        ctx.textAlign = 'center';
        ctx.font = '600 17px "JetBrains Mono", monospace';

        for (let cIdx = 0; cIdx < totalWeeks; cIdx++) {
            const cx = padL + lblW + cIdx * colW;
            let cBg = r.cellBg, cFg = r.cellFg, valText = "-";

            if (rIdx === 0) {
                valText = String(cIdx + 1);
            } else if (rIdx === 1) {
                valText = rencana[cIdx] !== undefined ? Number(rencana[cIdx]).toFixed(1) : "-";
            } else if (rIdx === 2) {
                if (cIdx <= lastIdx && realisasi[cIdx] !== undefined) valText = Number(realisasi[cIdx]).toFixed(1);
            } else if (rIdx === 3) {
                if (cIdx <= lastIdx && realisasi[cIdx] !== undefined && rencana[cIdx] !== undefined) {
                    const dev = realisasi[cIdx] - rencana[cIdx];
                    valText = (dev > 0 ? "+" : "") + dev.toFixed(1);
                    if (dev < 0) { cBg = "#fef2f2"; cFg = "#ef4444"; }
                    else if (dev > 0) { cBg = "#ecfdf5"; cFg = "#15803d"; }
                }
            }

            ctx.fillStyle = cBg;
            ctx.fillRect(cx, ry, colW, rowH);
            ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
            ctx.strokeRect(cx, ry, colW, rowH);

            ctx.fillStyle = cFg;
            ctx.fillText(valText, cx + colW / 2, ry + rowH / 2);
        }
    });

    // 5. Header Atas & Legenda
    ctx.textAlign = 'left';
    ctx.font = 'bold 26px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#152e4d';
    ctx.fillText('KURVA S PROGRES FISIK KEGIATAN', padL, 45);

    const legX = W - padR - 380;
    ctx.strokeStyle = '#152e4d'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(legX, 45); ctx.lineTo(legX + 35, 45); ctx.stroke();
    ctx.font = '600 19px "Plus Jakarta Sans", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Rencana Kumulatif', legX + 45, 45);

    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(legX + 230, 45); ctx.lineTo(legX + 265, 45); ctx.stroke();
    ctx.fillText('Realisasi', legX + 275, 45);
}
    

    return { 
    flowUrlHint, authHelp, getv, sanitizeForPath, resolveKegiatanFolder, bytesToBase64, 
    BULAN, parseTgl, fmtTanggal, hariInklusif, fmtAngka, fmtRupiah, sanitizeControlChars, 
    textWidthEmu, wrapLineCount, prepareImageFile,
    calcScheduleWeeks, calcCutoffWeek, parseNumberSeries, toEmbedPptxUrl, renderKurvaSCanvas
};
});
