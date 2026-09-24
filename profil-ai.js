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
    return { rapikan, prompt, clean, angkaBerubah, MODELS };
});
