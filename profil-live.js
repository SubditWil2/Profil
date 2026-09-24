/**
 * PROFIL-LIVE.JS — adaptor data master DMS (flow GetMasterData, HANYA BACA).
 * Meniru cara notulensi.html/notadinas.html membaca respons: kunci bervariasi, masterKegiatanGabungan bisa string "][".
 * Cache memakai key sendiri (profil_dev_cache) supaya tidak mengganggu cache halaman produksi.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'));
    else root.ProfilLive = factory(root.ProfilKit);
})(typeof self !== 'undefined' ? self : this, function (Kit) {
    const CACHE_KEY = 'profil_dev_cache', CACHE_TIME_KEY = 'profil_dev_cache_time', TTL = 5 * 60 * 1000;
    const arr = x => Array.isArray(x) ? x : (x && Array.isArray(x.value) ? x.value : []);

    /** Turunan buildKegiatanMapFromArray() dms-shared.js. */
    function kegiatanMap(list) {
        const map = {};
        arr(list).forEach(it => {
            const prov = Kit.getv(it, ['Provinsi', 'provinsi']), nama = Kit.getv(it, ['Nama Kegiatan', 'Nama_x0020_Kegiatan', 'NamaKegiatan', 'nama_kegiatan', 'kegiatan']);
            if (!prov || !nama) return; const p = String(prov).trim(), n = String(nama).trim();
            (map[p] = map[p] || new Set()).add(n);
        });
        Object.keys(map).forEach(p => map[p] = Array.from(map[p]).sort((a, b) => a.localeCompare(b)));
        return map;
    }
    function parseGabungan(v) {
        if (!v) return null;
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') { try { return JSON.parse(v.trim().replace(/\]\s*\[/g, ',')); } catch (e) { return null; } }
        return null;
    }

    /** Respons mentah getData -> {provinsi[], kegiatanByProv, rows (ND-Surat + kegiatan), geminiKeys[]} */
    function parseMaster(raw) {
        if (typeof raw === 'string') raw = JSON.parse(raw);
        raw = raw || {};
        const nd = arr(raw.notadinas || raw['ND-Surat'] || raw.rekapND || raw.notaDinas);
        const keg = arr(raw.kegiatan || raw.RekapData || raw['Rekap - 2026']);
        const provRows = arr(raw.provinsi || raw.Provinsi_Master || raw.Category);
        let map; const gab = parseGabungan(raw.masterKegiatanGabungan);
        map = gab && gab.length ? kegiatanMap(gab) : kegiatanMap(keg.concat(nd));
        const provinsi = Array.from(new Set(provRows.map(r => Kit.getv(r, ['Provinsi', 'provinsi'])).filter(Boolean).map(x => String(x).trim()).concat(Object.keys(map)))).sort();
        const keys = arr(raw.geminiKey).map(r => ({ n: String(r.NamaSetting || r.namaSetting || r.namasetting || ''), v: String(r.Nilai || r.nilai || '').trim() }))
            .filter(k => k.n.toLowerCase().includes('geminiapi') && k.v).map(k => k.v);
        return { provinsi, kegiatanByProv: map, rows: nd.concat(keg), geminiKeys: keys };
    }

    /** sessionStorage bisa melempar galat (mode privat / origin tertutup): jangan sampai memutus alur. */
    function defaultStorage() { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch (e) { return null; } }
    function readCache(storage) {
        try { const c = storage && storage.getItem(CACHE_KEY), t = storage && storage.getItem(CACHE_TIME_KEY); if (c && t && Date.now() - +t < TTL) return JSON.parse(c); } catch (e) { }
        return null;
    }
    function writeCache(storage, raw) { try { storage.setItem(CACHE_KEY, JSON.stringify(raw)); storage.setItem(CACHE_TIME_KEY, String(Date.now())); } catch (e) { } }
    function clearCache(storage) { storage = storage || defaultStorage(); try { storage.removeItem(CACHE_KEY); storage.removeItem(CACHE_TIME_KEY); } catch (e) { } }

    /** POST {action:'getData'} ke flow yang sama dengan halaman produksi. opts: {url, fetchImpl, storage, force} */
    async function fetchMaster(opts) {
        const storage = opts.storage || defaultStorage(), f = opts.fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
        let raw = opts.force ? null : readCache(storage);
        if (!raw) {
            if (!opts.url) throw new Error('getDataFlowUrl belum diisi di profil-config.js');
            const res = await f(opts.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'getData' }) });
            if (!res.ok) throw new Error(`Gagal memuat data master (HTTP ${res.status})`);
            raw = await res.json(); if (typeof raw === 'string') raw = JSON.parse(raw);
            writeCache(storage, raw);
        }
        return parseMaster(raw);
    }
    return { parseMaster, fetchMaster, kegiatanMap, clearCache, CACHE_KEY };
});
