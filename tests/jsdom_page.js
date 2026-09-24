/* Pembantu uji: memuat profil.html di jsdom (canvas/clipboard di-stub) dengan semua skrip lokal dievaluasi. */
const fs = require('fs'), path = require('path'), { JSDOM } = require('jsdom'), PizZip = require('pizzip');
const _is = require('image-size'), sizeOf = _is.imageSize || _is.default || _is;
const ROOT = path.join(__dirname, '..');
exports.ROOT = ROOT;
exports.load = function (opts) {
    opts = opts || {}; const blobs = [];
    let html = fs.readFileSync(path.join(ROOT, 'profil.html'), 'utf8');
    const scripts = [...html.matchAll(/<script src="((?!https?:)[^"]+)"><\/script>/g)].map(m => m[1]);
    html = html.replace(/<script src="[^"]+"><\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true }); const w = dom.window;
    w.PizZip = PizZip; if (opts.embed) w.PROFIL_EMBED = opts.embed;
    w.URL.createObjectURL = b => { blobs.push(b); return 'blob:test/' + blobs.length; };
    w.createImageBitmap = async blob => { const d = sizeOf(Buffer.from(await blob.arrayBuffer())); return { width: d.width, height: d.height, close() { } }; };
    w.HTMLAnchorElement.prototype.click = function () { };
    const remote = opts.fetch || fetch;
    w.fetch = async (url, o) => {            // alamat relatif = berkas lokal (template, sample_data); selebihnya ke stub/jaringan
        if (!/^https?:/.test(url)) { const buf = fs.readFileSync(path.join(ROOT, url.split('?')[0])); return { ok: true, status: 200, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), json: async () => JSON.parse(buf.toString('utf8')), text: async () => buf.toString('utf8') }; }
        return remote(url, o);
    };
    w.confirm = opts.confirm || (() => true);
    for (const f of scripts) { if (f.startsWith('libs/')) continue; w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n'); if (f === 'profil-config.js' && opts.config) Object.assign(w.PROFIL_CONFIG, opts.config); }
    let stubNo = 0; const pool = opts.pool || [];
    if (pool.length) w.ProfilKit.prepareImageFile = async () => { const k = pool[(stubNo++) % pool.length]; const buf = fs.readFileSync(path.join(ROOT, 'sample_data', k)); const d = sizeOf(buf); return { data: new Uint8Array(buf), w: d.width, h: d.height, ext: 'jpg' }; };
    w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
    return { w, blobs, $: id => w.document.getElementById(id), sleep: ms => new Promise(r => setTimeout(r, ms)) };
};
exports.pasteEv = w => { const ev = new w.Event('paste', { bubbles: true, cancelable: true }); ev.clipboardData = { items: [{ kind: 'file', type: 'image/png', getAsFile: () => new w.File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }) }], types: ['Files'], getData: () => '' }; w.document.dispatchEvent(ev); return ev; };
