/**
 * PPTX-ENGINE.JS — mesin template PPTX untuk Profil Kegiatan (Fase 1).
 *
 * Alur: template (slide prototipe) + slide plan -> salin & isi slide -> paket PPTX baru.
 * Tanpa docxtemplater. Hanya butuh PizZip + DOMParser/XMLSerializer (bawaan browser;
 * di Node disuntikkan lewat `env`). Konvensi template: lihat templates/template_manifest.json.
 *
 *   const { bytes, warnings } = PptxEngine.render({ templateBytes, manifest, plan, images, env });
 *   images: { [key]: { data: Uint8Array, w, h, ext: 'jpg'|'png' } }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./profil-kit.js'));
    else root.PptxEngine = factory(root.ProfilKit);
})(typeof self !== 'undefined' ? self : this, function (Kit) {

    const NS = {
        p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
        a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
        r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
        ct: 'http://schemas.openxmlformats.org/package/2006/content-types'
    };
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
    const TAG = /\{(@?[A-Za-z_][\w.]*)\}/g;

    // ---------- util DOM ----------
    const $ = (n, ns, local) => Array.from(n.getElementsByTagNameNS(ns, local));
    const kids = (n, ns, local) => Array.from(n.childNodes).filter(c => c.nodeType === 1 && c.localName === local && c.namespaceURI === ns);
    const pText = p => $(p, NS.a, 't').map(t => t.textContent).join('');
    const rm = n => n && n.parentNode && n.parentNode.removeChild(n);
    const ancestorShape = el => { while (el && !(el.namespaceURI === NS.p && ['sp', 'pic', 'graphicFrame', 'grpSp'].includes(el.localName))) el = el.parentNode; return el; };
    const hasTags = t => { TAG.lastIndex = 0; return TAG.test(t); };

    function setParaText(p, text) {
        const runs = kids(p, NS.a, 'r');
        if (!runs.length) {
            const doc = p.ownerDocument, r = doc.createElementNS(NS.a, 'a:r'), t = doc.createElementNS(NS.a, 'a:t');
            const end = kids(p, NS.a, 'endParaRPr')[0];
            if (end) { const rpr = end.cloneNode(true); const nr = doc.createElementNS(NS.a, 'a:rPr'); Array.from(rpr.attributes).forEach(a => nr.setAttribute(a.name, a.value)); Array.from(rpr.childNodes).forEach(c => nr.appendChild(c)); r.appendChild(nr); }
            r.appendChild(t); end ? p.insertBefore(r, end) : p.appendChild(r); runs.push(r);
        }
        for (let i = 1; i < runs.length; i++) rm(runs[i]);
        kids(p, NS.a, 'fld').concat(kids(p, NS.a, 'br')).forEach(rm);
        const rpr = kids(runs[0], NS.a, 'rPr')[0];
        if (rpr) { rpr.removeAttribute('err'); rpr.setAttribute('dirty', '0'); }
        const ts = kids(runs[0], NS.a, 't'); const t = ts[0] || runs[0].appendChild(runs[0].ownerDocument.createElementNS(NS.a, 'a:t'));
        t.textContent = text;
    }

    /** Jika sebuah tag terbelah antar-run, gabungkan run pada paragraf itu. */
    function mergeSplitTags(doc) {
        $(doc, NS.a, 'p').forEach(p => {
            const runs = kids(p, NS.a, 'r'); if (runs.length < 2) return;
            const texts = runs.map(r => $(r, NS.a, 't').map(t => t.textContent).join(''));
            const bad = texts.some(t => (t.match(/\{/g) || []).length !== (t.match(/\}/g) || []).length);
            if (bad) setParaText(p, texts.join(''));
        });
    }

    function xfrmOf(el) {
        const off = $(el, NS.a, 'off')[0], ext = $(el, NS.a, 'ext').find(e => e.hasAttribute('cx'));
        return { off, ext, x: +off.getAttribute('x'), y: +off.getAttribute('y'), w: +ext.getAttribute('cx'), h: +ext.getAttribute('cy') };
    }
    const setRect = (el, r) => { const f = xfrmOf(el); f.off.setAttribute('x', Math.round(r.x)); f.off.setAttribute('y', Math.round(r.y)); f.ext.setAttribute('cx', Math.round(r.w)); f.ext.setAttribute('cy', Math.round(r.h)); };

    // ---------- geometri foto ----------
    const GAP = 90000;
    const PATTERN = {
        pola: { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [2, 3], 6: [3, 3] },
        kolom2: { 1: [1], 2: [2], 3: [2, 1], 4: [2, 2], 5: [2, 2, 1], 6: [2, 2, 2] }
    };
    function gridRects(n, rect, mode, aspect) {
        const pat = PATTERN[mode][n]; if (!pat) throw new Error(`Jumlah foto per slide tidak didukung: ${n}`);
        const r = pat.length, cmax = Math.max(...pat), out = [];
        let w, h;
        if (mode === 'pola') {
            w = Math.min((rect.w - (cmax - 1) * GAP) / cmax, ((rect.h - (r - 1) * GAP) / r) * aspect); h = w / aspect;
        } else {
            const cw = (rect.w - GAP) / 2; w = cw;
            h = Math.min(Math.max((rect.h - (r - 1) * GAP) / r, cw / 2.1), cw / 1.5);
        }
        const total = r * h + (r - 1) * GAP, y0 = rect.y + Math.max(0, (rect.h - total) / 2);
        pat.forEach((c, ri) => {
            const cellW = (mode === 'kolom2' && c === 1) ? rect.w : w;
            const rowW = c * cellW + (c - 1) * GAP, x0 = rect.x + (rect.w - rowW) / 2;
            for (let k = 0; k < c; k++) out.push({ x: Math.round(x0 + k * (cellW + GAP)), y: Math.round(y0 + ri * (h + GAP)), w: Math.round(cellW), h: Math.round(h) });
        });
        return out;
    }
    /** srcRect (satuan 1/1000 persen) agar foto memenuhi sel (cover) tanpa distorsi. */
    function coverCrop(iw, ih, cw, ch) {
        const a = iw / ih, c = cw / ch; let l = 0, t = 0;
        if (a > c) l = (1 - c / a) / 2 * 100000; else t = (1 - a / c) / 2 * 100000;
        return { l: Math.round(l), r: Math.round(l), t: Math.round(t), b: Math.round(t) };
    }
    function containRect(iw, ih, r) {
        const k = Math.min(r.w / iw, r.h / ih), w = iw * k, h = ih * k;
        return { x: Math.round(r.x + (r.w - w) / 2), y: Math.round(r.y + (r.h - h) / 2), w: Math.round(w), h: Math.round(h) };
    }

    // ---------- pengisian satu slide ----------
    function maxId(doc) { return Math.max(0, ...$(doc, NS.p, 'cNvPr').map(c => +c.getAttribute('id') || 0)); }

    function substRow(row, lookup, warn) {
        let seen = false, nonEmpty = false;
        $(row, NS.a, 'p').forEach(p => {
            const t = pText(p); if (!hasTags(t)) return;
            const nt = t.replace(TAG, (m, k) => { if (k[0] === '@') return m; seen = true; const v = lookup(k); if (v === undefined) { warn(`Tag tidak dikenal: {${k}}`); return ''; } if (String(v) !== '') nonEmpty = true; return String(v); });
            setParaText(p, nt);
        });
        return !seen || nonEmpty;
    }
    const groupOf = row => { for (const p of $(row, NS.a, 'p')) { const t = pText(p); TAG.lastIndex = 0; let m; while ((m = TAG.exec(t))) if (m[1].includes('.')) return m[1].split('.')[0]; } return null; };

    function handleTables(ctx) {
        const { doc, item, manifest } = ctx; const values = item.values || {}, groups = item.groups || {};
        const lookup = k => values[k];
        $(doc, NS.a, 'tbl').forEach(tbl => {
            const frame = ancestorShape(tbl); const tname = $(frame, NS.p, 'cNvPr')[0].getAttribute('name');
            const cfg = ((manifest.prototypes[item.type] || {}).tables || {})[tname] || {};
            const allRows = kids(tbl, NS.a, 'tr'); const generated = []; const groupsFound = [];
            for (let i = 0; i < allRows.length;) {          // tentukan grup baris dari snapshot awal
                const g = groupOf(allRows[i]); if (!g) { i++; continue; }
                let j = i; while (j + 1 < allRows.length && groupOf(allRows[j + 1]) === g) j++;
                groupsFound.push({ g, proto: allRows.slice(i, j + 1) }); i = j + 1;
            }
            groupsFound.forEach(({ g, proto }) => {
                const first = proto[0];
                (groups[g] || []).forEach((it, k) => proto.forEach(pr => {
                    const c = pr.cloneNode(true);
                    const keep = substRow(c, key => { const [gg, f] = key.split('.'); return (gg === g && key.includes('.')) ? (it[f] === undefined ? '' : it[f]) : lookup(key); }, ctx.warn);
                    if (keep) { first.parentNode.insertBefore(c, first); generated.push({ row: c, k }); }
                }));
                proto.forEach(rm);
            });
            const generatedSet = new Set(generated.map(x => x.row));
            kids(tbl, NS.a, 'tr').filter(r => !generatedSet.has(r)).forEach(r => { if (!substRow(r, lookup, ctx.warn)) rm(r); });   // baris skalar; kosong dibuang
            // selang-seling warna + tinggi baris
            if (cfg.zebra) generated.forEach(({ row, k }) => $(row, NS.a, 'tcPr').forEach(pr => { const sf = kids(pr, NS.a, 'solidFill')[0]; if (sf && sf.firstChild) sf.firstChild.setAttribute('val', cfg.zebra[k % cfg.zebra.length]); }));
            if (item.rowHeights && generated.length) {
                generated.forEach(({ row, k }) => row.setAttribute('h', item.rowHeights[k]));
                const hdr = kids(tbl, NS.a, 'tr')[0]; const sum = kids(tbl, NS.a, 'tr').reduce((s, r) => s + (+r.getAttribute('h') || 0), 0);
                const ext = $(frame, NS.p, 'xfrm')[0]; if (ext) $(ext, NS.a, 'ext')[0].setAttribute('cy', sum);
            }
        });
    }

    function expandLists(ctx) {
        const lists = ctx.item.lists || {};
        $(ctx.doc, NS.a, 'p').forEach(p => {
            const m = pText(p).trim().match(/^\{@(\w+)\}$/); if (!m) return;
            const items = lists[m[1]];
            if (items === undefined) ctx.warn(`Daftar tidak dikenal: {@${m[1]}}`);
            (items || []).forEach(t => { const c = p.cloneNode(true); setParaText(c, t); p.parentNode.insertBefore(c, p); });
            if (!(items || []).length && kids(p.parentNode, NS.a, 'p').length === 1) setParaText(p, ''); else rm(p);
        });
    }

    function fillShapes(ctx) {
        const values = ctx.item.values || {};
        $(ctx.doc, NS.p, 'sp').forEach(sp => {
            const name = $(sp, NS.p, 'cNvPr')[0].getAttribute('name') || ''; if (/^(area|img|proto):/.test(name)) return;
            let seen = false;
            $(sp, NS.a, 'p').forEach(p => {
                const t = pText(p); if (!hasTags(t)) return;
                setParaText(p, t.replace(TAG, (m, k) => { if (k[0] === '@') return m; seen = true; const v = values[k]; if (v === undefined) { ctx.warn(`Tag tidak dikenal: {${k}}`); return ''; } return String(v); }));
            });
            if (seen && $(sp, NS.a, 'p').map(pText).join('').trim() === '') rm(sp);
        });
    }

    // ---------- tata letak tabel bertumpuk (slide profil): tinggi tabel ikut isi ----------
    const attrInt = (el, n, d) => (el && el.hasAttribute(n)) ? +el.getAttribute(n) : d;
    function estimateTable(tbl, scale) {
        const cols = kids(kids(tbl, NS.a, 'tblGrid')[0], NS.a, 'gridCol').map(c => +c.getAttribute('w'));
        const rowH = []; let total = 0;
        kids(tbl, NS.a, 'tr').forEach(tr => {
            let need = 0, ci = 0;
            kids(tr, NS.a, 'tc').forEach(tc => {
                const span = attrInt(tc, 'gridSpan', 1), hm = tc.hasAttribute('hMerge');
                if (!hm) {
                    const w = cols.slice(ci, ci + span).reduce((a, b) => a + b, 0), pr = kids(tc, NS.a, 'tcPr')[0];
                    const mL = attrInt(pr, 'marL', 91440), mR = attrInt(pr, 'marR', 91440), mT = attrInt(pr, 'marT', 45720), mB = attrInt(pr, 'marB', 45720);
                    let hh = mT + mB;
                    const ps = $(tc, NS.a, 'p');
                    ps.forEach((p, pi) => {
                        const rpr = $(p, NS.a, 'rPr')[0] || $(p, NS.a, 'endParaRPr')[0], sz = (attrInt(rpr, 'sz', 1000) * scale) / 100, bold = rpr && rpr.getAttribute('b') === '1';
                        const ppr = kids(p, NS.a, 'pPr')[0], ind = attrInt(ppr, 'marL', 0);
                        const ln = ppr && kids(ppr, NS.a, 'lnSpc')[0], lnPct = ln && $(ln, NS.a, 'spcPct')[0] ? +$(ln, NS.a, 'spcPct')[0].getAttribute('val') / 100000 : 1;
                        const lines = Kit.wrapLineCount(pText(p) || ' ', Math.max(200000, w - mL - mR - ind), sz, bold);
                        hh += lines * sz * 1.15 * lnPct * 12700;
                        const sp = (tag) => { const e = ppr && kids(ppr, NS.a, tag)[0]; const v = e && $(e, NS.a, 'spcPts')[0]; return v ? (+v.getAttribute('val') / 100) * 12700 * scale : 0; };
                        if (pi < ps.length - 1) hh += sp('spcAft'); if (pi > 0) hh += sp('spcBef');   // PowerPoint mengabaikan spcAft paragraf terakhir di sel
                    });
                    need = Math.max(need, hh + 6350);
                }
                ci += span;
            });
            rowH.push(Math.round(Math.max(need * 1.03, attrInt(tr, 'h', 152198) * scale)));   // +3% cadangan (kalibrasi: PowerPoint menghitung tabel spek contoh 2,97 juta EMU)
        });
        rowH.forEach(x => total += x); return { rowH, total };
    }
    function applyScale(tbl, scale) {
        if (scale === 1) return;
        $(tbl, NS.a, 'rPr').concat($(tbl, NS.a, 'endParaRPr')).forEach(r => { if (r.hasAttribute('sz')) r.setAttribute('sz', Math.max(600, Math.round(+r.getAttribute('sz') * scale / 10) * 10)); });
    }
    function layoutStack(ctx) {
        const cfg = (ctx.manifest.rules || {}).stackTables; if (!cfg || ctx.item.type !== 'profil') return;
        const frames = {}; $(ctx.doc, NS.p, 'graphicFrame').forEach(f => frames[$(f, NS.p, 'cNvPr')[0].getAttribute('name')] = f);
        const top = frames[cfg.top], bot = frames[cfg.bottom]; if (!top || !bot) return;
        const tTbl = $(top, NS.a, 'tbl')[0], bTbl = $(bot, NS.a, 'tbl')[0];
        const topY = +$(top, NS.p, 'xfrm')[0].getElementsByTagNameNS(NS.a, 'off')[0].getAttribute('y');
        let scale = 1, et, eb, ok = false;
        for (const sc of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]) {
            if (sc < (cfg.minScale || 0.7)) break; scale = sc; et = estimateTable(tTbl, sc); eb = estimateTable(bTbl, sc);
            if (topY + et.total + (cfg.gapEmu || 70000) <= cfg.bottomEdgeEmu - eb.total) { ok = true; break; }
        }
        if (typeof process !== 'undefined' && process.env && process.env.PROFIL_DEBUG) console.log('  [layoutStack] scale', scale, 'spek', et.total, et.rowH.join(','), '| masalah', eb.total, eb.rowH.join(','), '| topY', topY);
        if (!ok) ctx.warn('Slide profil terlalu padat (daftar pihak/lingkup/masalah terlalu panjang); tabel bisa saling menempel. Ringkas teks.');
        applyScale(tTbl, scale); applyScale(bTbl, scale);
        [[top, tTbl, et], [bot, bTbl, eb]].forEach(([f, t, e]) => { kids(t, NS.a, 'tr').forEach((r, i) => r.setAttribute('h', e.rowH[i])); $(f, NS.p, 'xfrm')[0].getElementsByTagNameNS(NS.a, 'ext')[0].setAttribute('cy', e.total); });
        $(bot, NS.p, 'xfrm')[0].getElementsByTagNameNS(NS.a, 'off')[0].setAttribute('y', Math.round(cfg.bottomEdgeEmu - eb.total));
        if (scale < 1) ctx.warn(`Slide profil: font tabel diperkecil ke ${Math.round(scale * 100)}% agar muat.`);
    }

    // ---------- kotak teks bertumpuk (slide latar): ukuran font menyesuaikan panjang teks ----------
    function estimateBox(sp, pt) {
        const bp = $(sp, NS.a, 'bodyPr')[0]; const w = xfrmOf(sp).w - attrInt(bp, 'lIns', 91440) - attrInt(bp, 'rIns', 91440);
        let h = attrInt(bp, 'tIns', 45720) + attrInt(bp, 'bIns', 45720);
        $(sp, NS.a, 'p').forEach(p => { const rpr = $(p, NS.a, 'rPr')[0]; h += Kit.wrapLineCount(pText(p) || ' ', w, pt, rpr && rpr.getAttribute('b') === '1') * pt * 1.15 * 12700; });
        return Math.round(h * 1.03);
    }
    function fitStack(ctx) {
        const cfg = ((ctx.manifest.rules || {}).fitText || {})[ctx.item.type]; if (!cfg) return;
        const byName = {}; $(ctx.doc, NS.p, 'sp').forEach(sp => byName[$(sp, NS.p, 'cNvPr')[0].getAttribute('name')] = sp);
        const b1 = byName[cfg.boxes[0]], b2 = byName[cfg.boxes[1]]; if (!b1 || !b2) return;
        const y1 = xfrmOf(b1).y, y2t = xfrmOf(b2).y, sizes = cfg.sizesPt; let pick = null;
        for (const pt of sizes) { const h1 = estimateBox(b1, pt), h2 = estimateBox(b2, pt), y2 = Math.max(y2t, y1 + h1 + cfg.gapEmu); if (y2 + h2 <= cfg.bottomEdgeEmu) { pick = { pt, h1, h2, y2 }; break; } }
        if (!pick) { const pt = sizes[sizes.length - 1], h1 = estimateBox(b1, pt), h2 = estimateBox(b2, pt); pick = { pt, h1, h2, y2: Math.max(y2t, y1 + h1 + cfg.gapEmu) }; ctx.warn('Latar belakang / maksud terlalu panjang meski font terkecil; teks bisa keluar slide. Ringkas teks.'); }
        if (pick.pt !== sizes[0]) { ctx.warn(`Slide latar: font teks diperkecil ke ${pick.pt} pt agar muat.`); [b1, b2].forEach(b => $(b, NS.a, 'rPr').concat($(b, NS.a, 'endParaRPr')).forEach(r => r.setAttribute('sz', pick.pt * 100))); }
        const set = (b, y, h) => { const f = xfrmOf(b); f.off.setAttribute('y', y); f.ext.setAttribute('cy', h); };
        set(b1, y1, pick.h1); set(b2, pick.y2, pick.h2);
    }

    function picXml(id, name, descr, rId, rect, crop) {
        const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const src = crop && (crop.l || crop.t) ? `<a:srcRect${crop.l ? ` l="${crop.l}" r="${crop.r}"` : ''}${crop.t ? ` t="${crop.t}" b="${crop.b}"` : ''}/>` : '';
        return `<p:pic xmlns:p="${NS.p}" xmlns:a="${NS.a}" xmlns:r="${NS.r}"><p:nvPicPr><p:cNvPr id="${id}" name="${esc(name)}" descr="${esc(descr)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
            `<p:blipFill><a:blip r:embed="${rId}"/>${src}<a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
            `<p:spPr><a:xfrm><a:off x="${rect.x}" y="${rect.y}"/><a:ext cx="${rect.w}" cy="${rect.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
    }

    function slots(ctx) {
        const { doc, item, manifest } = ctx; const rules = manifest.rules || {};
        const byName = {}; $(doc, NS.p, 'cNvPr').forEach(c => { const sh = ancestorShape(c); if (sh) byName[c.getAttribute('name')] = sh; });
        const newId = () => ++ctx.nextId;
        const insertPic = (before, key, rect, fit, name, descr) => {
            const img = ctx.images[key]; if (!img) throw new Error(`Gambar tidak ditemukan: ${key}`);
            const rId = ctx.addImage(key); let r = rect, crop = null;
            if (fit === 'contain') r = containRect(img.w, img.h, rect); else crop = coverCrop(img.w, img.h, rect.w, rect.h);
            const node = doc.importNode(new ctx.env.DOMParser().parseFromString(picXml(newId(), name, descr, rId, r, crop), 'application/xml').documentElement, true);
            before.parentNode.insertBefore(node, before); return node;
        };
        // a) slot gambar tunggal
        Object.keys(byName).filter(n => n.startsWith('img:')).forEach(n => {
            const ph = byName[n], key = (item.images || {})[n.slice(4)];
            if (key) insertPic(ph, key, xfrmOf(ph), (rules.slotFit || {})[n] || (rules.slotFit || {}).default || 'cover', n.slice(4), n.slice(4));
            rm(ph);
        });
        // b) area foto (grid + keterangan)
        const area = byName['area:foto'], proto = byName['proto:caption'];
        if (area) {
            const photos = item.photos || [];
            if (photos.length) {
                const mode = (rules.gridMode || {})[item.type] || 'pola'; const rects = gridRects(photos.length, xfrmOf(area), mode, rules.cellAspect || 1.64);
                const upper = (rules.captionCase || {})[item.type] === 'upper';
                photos.forEach((ph, i) => {
                    const rc = rects[i]; insertPic(area, ph.key, rc, 'cover', `Foto ${i + 1}`, ph.caption || `Foto ${i + 1}`);
                    if (proto && ph.caption) {
                        const cap = proto.cloneNode(true), cid = $(cap, NS.p, 'cNvPr')[0]; cid.setAttribute('id', newId()); cid.setAttribute('name', `Keterangan ${i + 1}`); cid.removeAttribute('descr');
                        const ph0 = xfrmOf(proto); setRect(cap, { x: rc.x, y: rc.y + rc.h - ph0.h, w: rc.w, h: ph0.h });
                        const ps = $(cap, NS.a, 'p'); ps.slice(1).forEach(rm);
                        const text = upper ? ph.caption.toUpperCase() : ph.caption; setParaText(ps[0], text);
                        const rpr = $(ps[0], NS.a, 'rPr')[0];
                        if (rpr) { let sz = +rpr.getAttribute('sz') || 1000; const bold = rpr.getAttribute('b') === '1';
                            while (sz > 700 && Kit.textWidthEmu(text, sz / 100, bold) > rc.w - 2 * 91440) sz -= 50; rpr.setAttribute('sz', sz); }
                        area.parentNode.insertBefore(cap, area);
                    }
                });
            }
            rm(area);
        }
        Object.keys(byName).filter(n => n.startsWith('proto:')).forEach(n => rm(byName[n]));
    }

    // ---------- paket ----------
    const relsPath = part => part.replace(/([^\/]+)$/, '_rels/$1.rels');
    function resolve(baseFile, target) {
        const parts = baseFile.split('/'); parts.pop(); target.split('/').forEach(seg => { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); });
        return parts.join('/');
    }

    function render(opts) {
        const env = Object.assign({ PizZip: typeof PizZip !== 'undefined' ? PizZip : undefined, DOMParser: typeof DOMParser !== 'undefined' ? DOMParser : undefined, XMLSerializer: typeof XMLSerializer !== 'undefined' ? XMLSerializer : undefined }, opts.env || {});
        const { manifest, plan } = opts; const images = opts.images || {}; const warnings = [];
        if (!env.PizZip) throw new Error('Pustaka PizZip belum termuat (libs/pizzip.min.js).');
        if (!env.DOMParser || !env.XMLSerializer) throw new Error('DOMParser/XMLSerializer tidak tersedia di lingkungan ini.');
        const dp = new env.DOMParser(), xs = new env.XMLSerializer();
        const parse = s => { const d = dp.parseFromString(s, 'application/xml'); const e = d.getElementsByTagName('parsererror'); if (e.length) throw new Error('XML tidak valid: ' + (e[0].textContent || '').slice(0, 160)); return d; };
        const ser = d => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xs.serializeToString(d).replace(/^<\?xml[^>]*\?>\s*/, '');
        const zip = new env.PizZip(opts.templateBytes);
        const read = p => { const f = zip.file(p); if (!f) throw new Error(`Berkas template tidak ada: ${p}`); return f.asText(); };

        // data wajib
        const g = (plan[0] && plan[0].values) || {}; const kosong = (manifest.required || []).filter(k => !String(g[k] === undefined ? '' : g[k]).trim());
        if (kosong.length) throw new Error('Data belum lengkap, kolom wajib kosong: ' + kosong.join(', '));

        const pres = parse(read('ppt/presentation.xml')), presRels = parse(read('ppt/_rels/presentation.xml.rels')), ct = parse(read('[Content_Types].xml'));
        const relMap = {}; $(presRels, NS.rel, 'Relationship').forEach(r => relMap[r.getAttribute('Id')] = r);
        const lst = $(pres, NS.p, 'sldIdLst')[0], sldEls = kids(lst, NS.p, 'sldId'), order = manifest.slideOrder;
        if (sldEls.length !== order.length) throw new Error(`Template punya ${sldEls.length} slide, manifest ${order.length}`);
        const protos = {}; sldEls.forEach((el, i) => { const rid = el.getAttributeNS(NS.r, 'id'); protos[order[i]] = { el, rid, part: 'ppt/' + relMap[rid].getAttribute('Target') }; });

        let slideNo = Math.max(0, ...Object.keys(zip.files).map(f => (f.match(/^ppt\/slides\/slide(\d+)\.xml$/) || [0, 0])[1] * 1));
        let relNo = Math.max(0, ...Object.keys(relMap).map(k => +k.replace(/\D/g, '') || 0));
        let sldIdNo = 255, mediaNo = 0; const imgParts = {};
        const addOverride = (part, type) => { const o = ct.createElementNS(NS.ct, 'Override'); o.setAttribute('PartName', '/' + part); o.setAttribute('ContentType', type); ct.documentElement.appendChild(o); };
        const ensureDefault = ext => { if (!$(ct, NS.ct, 'Default').some(d => d.getAttribute('Extension') === ext)) { const d = ct.createElementNS(NS.ct, 'Default'); d.setAttribute('Extension', ext); d.setAttribute('ContentType', ext === 'png' ? 'image/png' : 'image/jpeg'); ct.documentElement.insertBefore(d, ct.documentElement.firstChild); } };

        plan.forEach(item => {
            const proto = protos[item.type]; if (!proto) throw new Error(`Prototipe tidak dikenal: ${item.type}`);
            const doc = parse(read(proto.part)), rels = parse(read(relsPath(proto.part)));
            $(rels, NS.rel, 'Relationship').filter(r => r.getAttribute('Type') === REL + 'notesSlide').forEach(rm);
            const ctx = {
                doc, item, manifest, images, env, nextId: maxId(doc), warn: m => { if (!warnings.includes(m)) warnings.push(m); },
                addImage: key => {
                    const im = images[key]; if (!imgParts[key]) { mediaNo++; const ext = im.ext || 'jpg'; ensureDefault(ext); imgParts[key] = `profil_${String(mediaNo).padStart(3, '0')}.${ext}`; zip.file('ppt/media/' + imgParts[key], im.data); }
                    let n = 100; const used = new Set($(rels, NS.rel, 'Relationship').map(r => r.getAttribute('Id')));
                    while (used.has('rId' + n)) n++; const r = rels.createElementNS(NS.rel, 'Relationship'); r.setAttribute('Id', 'rId' + n); r.setAttribute('Type', REL + 'image'); r.setAttribute('Target', '../media/' + imgParts[key]); rels.documentElement.appendChild(r); return 'rId' + n;
                }
            };
            mergeSplitTags(doc); handleTables(ctx); expandLists(ctx); fillShapes(ctx); layoutStack(ctx); fitStack(ctx); slots(ctx);

            slideNo++; const part = `ppt/slides/slide${slideNo}.xml`;
            zip.file(part, ser(doc)); zip.file(relsPath(part), ser(rels));
            addOverride(part, 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
            relNo++; const pr = presRels.createElementNS(NS.rel, 'Relationship'); pr.setAttribute('Id', 'rId' + relNo); pr.setAttribute('Type', REL + 'slide'); pr.setAttribute('Target', `slides/slide${slideNo}.xml`); presRels.documentElement.appendChild(pr);
            sldIdNo++; const sid = pres.createElementNS(NS.p, 'p:sldId'); sid.setAttribute('id', String(sldIdNo)); sid.setAttributeNS(NS.r, 'r:id', 'rId' + relNo); lst.appendChild(sid);
        });

        // buang prototipe (+ notes-nya)
        Object.values(protos).forEach(pt => {
            const rp = relsPath(pt.part);
            if (zip.file(rp)) $(parse(read(rp)), NS.rel, 'Relationship').filter(r => r.getAttribute('Type') === REL + 'notesSlide').forEach(r => {
                const np = resolve(pt.part, r.getAttribute('Target')); zip.remove(np); zip.remove(relsPath(np));
                $(ct, NS.ct, 'Override').filter(o => o.getAttribute('PartName') === '/' + np).forEach(rm);
            });
            zip.remove(pt.part); zip.remove(rp); rm(pt.el); rm(relMap[pt.rid]);
            $(ct, NS.ct, 'Override').filter(o => o.getAttribute('PartName') === '/' + pt.part).forEach(rm);
        });
        // media yatim (hanya dipakai prototipe)
        const referenced = new Set();
        Object.keys(zip.files).filter(f => f.endsWith('.rels')).forEach(f => {
            const src = f.replace('_rels/', '').replace(/\.rels$/, ''); const base = src === '' ? '' : src;
            $(parse(zip.file(f).asText()), NS.rel, 'Relationship').forEach(r => { if (r.getAttribute('TargetMode') !== 'External') referenced.add(resolve(base.startsWith('/') ? base.slice(1) : base, r.getAttribute('Target'))); });
        });
        Object.keys(zip.files).filter(f => f.startsWith('ppt/media/') && !f.endsWith('/') && !referenced.has(f)).forEach(f => zip.remove(f));   // entri folder ('ppt/media/') jangan disentuh: remove() menghapus rekursif

        zip.file('ppt/presentation.xml', ser(pres)); zip.file('ppt/_rels/presentation.xml.rels', ser(presRels)); zip.file('[Content_Types].xml', ser(ct));
        return { bytes: zip.generate({ type: 'uint8array', compression: 'DEFLATE' }), warnings };
    }

    return { render, gridRects, coverCrop, containRect };
});
