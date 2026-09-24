/**
 * PROFIL-AI.JS — "Rapikan dengan AI" (Gemini). Turunan gemini-client.js: rotasi model x kunci, lewati 429/503.
 * Hanya merapikan bahasa & salah ketik dari teks yang diberikan; tidak boleh menambah fakta. Hasil selalu ditinjau pengguna sebelum dipakai.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'));
    else root.ProfilAI = factory(root.ProfilKit);
})(typeof self !== 'undefined' ? self : this, function (Kit) {
    const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];   // sama dengan GEMINI_MODELS.LITE di gemini-client.js
    const KIND = {
        latar: { unit: 'paragraf', sep: 'kosong', rule: 'Pertahankan urutan dan jumlah paragraf.' },
        maksud: { unit: 'paragraf', sep: 'kosong', rule: 'Pertahankan urutan dan jumlah paragraf.' },
        masalah: { unit: 'poin', sep: 'baris', rule: 'Satu poin per baris, tanpa nomor/bullet. Pertahankan jumlah poin. Tulis lugas: kondisi/kendala beserta angkanya.' },
        tindak: { unit: 'poin', sep: 'baris', rule: 'Satu poin per baris, tanpa nomor/bullet. Pertahankan jumlah poin. Tulis sebagai langkah tindak lanjut yang jelas (siapa mengerjakan apa).' }
    };
    function prompt(kind, text) {
        const k = KIND[kind]; if (!k) throw new Error('Jenis teks tidak dikenal: ' + kind);
        return 'Anda editor dokumen pemerintahan (Kementerian PU, Ditjen Cipta Karya). Rapikan teks berikut ke bahasa Indonesia formal yang baku dan lugas: perbaiki salah ketik, ejaan, dan tata kalimat.\n' +
            'ATURAN KETAT: (1) JANGAN menambah, menghapus, atau mengubah fakta, angka, nama, satuan, atau tanggal. (2) Pertahankan istilah teknis. (3) ' + k.rule + ' (4) Balas HANYA teks hasil, tanpa pembuka, penjelasan, atau tanda markdown. ' +
            (k.sep === 'kosong' ? '(5) Pisahkan paragraf dengan satu baris kosong.' : '(5) Pisahkan poin dengan satu baris baru.') + '\n\nTEKS:\n' + text;
    }
    function clean(out, kind) {
        let t = String(out || '').replace(/```[a-z]*|```/g, '').trim();
        if (KIND[kind].sep === 'baris') return t.split('\n').map(s => s.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean).join('\n');
        return t.replace(/\n{3,}/g, '\n\n');
    }
    /** opts: {keys[], kind, text, fetchImpl, models} -> {text, model} */
    async function rapikan(opts) {
        const keys = (opts.keys || []).filter(Boolean); if (!keys.length) throw new Error('Kunci Gemini tidak tersedia (muat data dari DMS dulu).');
        const text = String(opts.text || '').trim(); if (!text) throw new Error('Teks kosong.');
        const f = opts.fetchImpl || fetch, body = JSON.stringify({ contents: [{ parts: [{ text: prompt(opts.kind, text) }] }], generationConfig: { temperature: 0.2 } });
        for (const model of (opts.models || MODELS)) for (const key of keys) {
            let res; try { res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); } catch (e) { continue; }
            if (res.status === 429 || res.status === 503) continue;
            if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j.error && j.error.message) || `HTTP ${res.status}`); }
            const j = await res.json(); const out = j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text;
            if (!out) continue; return { text: clean(out, opts.kind), model };
        }
        throw new Error('Semua kunci dan model Gemini tidak tersedia. Coba beberapa saat lagi.');
    }
    /** Ringkasan perubahan angka: memperingatkan bila hasil AI mengubah/menghilangkan angka dari teks asli. */
    function angkaBerubah(asli, hasil) {
        const num = t => (String(t).match(/\d+(?:[.,]\d+)*/g) || []).sort(); const a = num(asli), b = num(hasil);
        return JSON.stringify(a) !== JSON.stringify(b);
    }

    const OCR_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash'];

    function promptOCR(totalWeeks) {
        let hint = '';
        if (totalWeeks && totalWeeks > 0) {
            hint = ` Informasi durasi: jadwal proyek ini diperkirakan berlangsung selama kurang lebih ${totalWeeks} minggu.`;
        }
        return 'Anda adalah AI asisten teknis konstruksi di Kementerian PU (Ditjen Cipta Karya). ' +
            'Tugas Anda adalah membaca gambar/screenshot tabel progres Kurva S dan mengekstrak deret angka persentase kumulatif mingguan.\n\n' +
            'ATURAN EKSTRAKSI:\n' +
            '1. Cari baris "Rencana Kumulatif (%)" atau "Rencana (%)" dari Minggu ke-1 (M1) sampai minggu terakhir.\n' +
            '2. Cari baris "Realisasi Kumulatif (%)" atau "Realisasi (%)" dari Minggu ke-1 (M1) sampai minggu cut-off terakhir yang terisi di gambar.\n' +
            '3. Ubah semua format desimal ke tanda titik desimal standar (contoh: 11,63 menjadi 11.63).\n' +
            '4. Hilangkan simbol "%", spasi, atau teks lain; ambil murni angka numerik saja.\n' +
            '5. Jangan mengarang angka jika tidak terlihat pada gambar. Jika realisasi hanya ada sampai minggu ke-16, isi array realisasi sampai minggu ke-16 saja.\n' +
            hint + '\n\n' +
            'FORMAT RESPON: Balas HANYA objek JSON valid persis seperti format di bawah ini tanpa teks pembuka atau penutup:\n' +
            '{\n' +
            '  "rencana": [0.04, 0.08, 0.67, 1.26, 2.27, ...],\n' +
            '  "realisasi": [0.05, 0.75, 1.25, 1.67, 2.70, ...]\n' +
            '}';
    }

    /**
     * OCR Gambar Tabel Kurva S.
     * opts: { keys: string[], imageBase64: string, mimeType?: string, totalWeeks?: number, fetchImpl?: Function }
     * return: Promise<{ rencana: number[], realisasi: number[], model: string }>
     */
    async function ocrTabelKurvaS(opts) {
        const keys = (opts.keys || []).filter(Boolean);
        if (!keys.length) throw new Error('Kunci Gemini tidak tersedia (muat data dari DMS dulu).');
        
        let rawB64 = String(opts.imageBase64 || '').trim();
        if (!rawB64) throw new Error('Gambar tabel Kurva S belum dipilih/ditempel.');
        
        // Bersihkan prefix data URL jika ada (data:image/jpeg;base64,...)
        const mimeMatch = rawB64.match(/^data:(image\/[a-zA-Z]+);base64,/);
        const mimeType = (mimeMatch && mimeMatch[1]) || opts.mimeType || 'image/jpeg';
        rawB64 = rawB64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

        const f = opts.fetchImpl || fetch;
        const promptText = promptOCR(opts.totalWeeks);

        const body = JSON.stringify({
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: rawB64
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json'
            }
        });

        for (const model of (opts.models || OCR_MODELS)) {
            for (const key of keys) {
                let res;
                try {
                    res = await f(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body
                    });
                } catch (e) {
                    continue;
                }

                if (res.status === 429 || res.status === 503) continue;
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error((j.error && j.error.message) || `HTTP ${res.status}`);
                }

                const j = await res.json();
                const outText = j && j.candidates && j.candidates[0] && j.candidates[0].content && 
                               j.candidates[0].content.parts && j.candidates[0].content.parts[0] && 
                               j.candidates[0].content.parts[0].text;
                if (!outText) continue;

                // Parsing JSON keluaran LLM
                try {
                    const cleanJson = outText.replace(/```[a-z]*|```/g, '').trim();
                    const parsed = JSON.parse(cleanJson);
                    const rencana = (parsed.rencana || []).map(n => Number(n)).filter(n => !isNaN(n));
                    const realisasi = (parsed.realisasi || []).map(n => Number(n)).filter(n => !isNaN(n));

                    if (!rencana.length && !realisasi.length) {
                        throw new Error('AI tidak menemukan angka tabel yang valid pada gambar ini.');
                    }

                    return { rencana, realisasi, model };
                } catch (err) {
                    throw new Error('Gagal memproses respon OCR: ' + err.message);
                }
            }
        }

        throw new Error('Semua model Gemini Vision tidak dapat dihubungi saat ini. Coba beberapa saat lagi.');
    }
    
    return { rapikan, prompt, clean, angkaBerubah, MODELS, ocrTabelKurvaS, promptOCR };
});
