// Vue de loin (zooms 5 à 12) : forêts de France précalculées (data/foret, BD Forêt V2) et météo de pousse du jour
// (data/meteo, Open-Meteo). De loin (zoom < FAR_Z) : « Ça pousse » = part de bons coins × météo des 14 derniers jours,
// cases de 1/20° (≈ 5 km). Plus près : potentiel d'habitat en cases de 1/400° (≈ 250 m), même formule que la carte détaillée.
import { Core as C } from './core.js';

export const FAR_Z = 9;
const WX_GOOD = 0.55;               // indice de pousse « probable » (core.pousseLabel)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function createFar(o) {
  const { map, st, CanvasLayer, POT_COL, log, gunzip, dataUrl, MONTH, DATA_Z } = o;
  const F = { idx: null, ver: '1', n: 400, have: new Set(), edge: [0, 0.3, 0.6, 0.9], tiles: new Map(), coarse: null, coarseSt: null, wx: null, wxSt: null, img: new Map(), scores: new Map() };
  const S = C.SPECIES, NS = S.length;
  const POT_RGB = POT_COL.map(c => (c ? hex(c) : null));
  const GROUP_RGB = [null].concat(C.GKEYS.map(k => hex(C.GROUPS[k].c)));
  let wxOn = true;
  map.createPane('far'); map.getPane('far').style.zIndex = 345; map.getPane('far').style.pointerEvents = 'none';
  const layer = new CanvasLayer('far');
  const key = (la, lo) => la + '_' + lo;
  const active = () => map.getZoom() < DATA_Z;
  const fine = () => map.getZoom() >= FAR_Z && map.getZoom() < DATA_Z;

  // ---------- chargements ----------
  fetch(dataUrl('data/foret/index.json')).then(r => (r.ok ? r.json() : null)).then(j => {
    if (!j || !Array.isArray(j.tiles)) { log('Vue de loin : pas de carte des forêts'); return; }
    F.idx = j; F.ver = String(j.v || 1); F.n = j.n || 400; F.edge = j.edge || F.edge;
    F.have = new Set(j.tiles.map(t => key(t[0], t[1])));
    sync();
  }).catch(e => log('Vue de loin : index indisponible (' + e.message + ')'));
  function loadCoarse() {
    if (F.coarseSt || !F.idx || !F.idx.coarse) return;
    F.coarseSt = 'q';
    const c = F.idx.coarse;
    fetch(dataUrl('data/foret/' + c.file + '?v=' + F.ver)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(gunzip).then(u => {
      const sz = c.rows * c.cols; if (u.length !== sz * c.layers.length) throw new Error('taille ' + u.length);
      const L = {}; c.layers.forEach((nm, i) => { L[nm] = u.subarray(i * sz, (i + 1) * sz); });
      // échelle propre à chaque espèce : 90e centile de la part de bons coins parmi les cases boisées
      const q90 = {};
      for (const sp of S) {
        const v = L[sp.id]; if (!v) continue;
        const a = []; for (let k = 0; k < sz; k++) if (L.forest[k] > 10) a.push(v[k]);
        a.sort((x2, y2) => x2 - y2);
        q90[sp.id] = Math.max(13, a.length ? a[Math.floor(a.length * 0.9)] : 255);
      }
      F.coarse = Object.assign({}, c, { L, q90 }); F.coarseSt = 'ok'; F.scores.clear(); draw(); changed();
    }).catch(e => { F.coarseSt = null; log('Carte de France : ' + e.message); });
  }
  function loadWx() {
    if (F.wxSt) return;
    F.wxSt = 'q';
    fetch(dataUrl('data/meteo/pousse.json'), { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))).then(j => {
      const step = j.step || 0.5, pts = j.pts || [];
      const lat0 = Math.min(...pts.map(p => p[0])), lon0 = Math.min(...pts.map(p => p[1]));
      const nr = Math.round((Math.max(...pts.map(p => p[0])) - lat0) / step) + 1, nc = Math.round((Math.max(...pts.map(p => p[1])) - lon0) / step) + 1;
      const grid = new Array(nr * nc).fill(null);
      for (const p of pts) {
        if (!p[8]) continue;
        const w = { r14: p[2], r3: p[3], t7: p[4], frost5: p[5], f7: p[6], ft7: p[7], ok: true };
        grid[Math.round((p[0] - lat0) / step) * nc + Math.round((p[1] - lon0) / step)] = w;
      }
      // indice de pousse de chaque espèce en chaque point
      const idx = S.map(sp => grid.map(w => (w ? C.pousse(sp, w, MONTH).idx : null)));
      F.wx = { v: j.v, step, lat0, lon0, nr, nc, idx };
      F.wxSt = 'ok'; F.scores.clear(); draw(); changed();
    }).catch(e => { F.wxSt = null; log('Météo de pousse : ' + e.message); });
  }
  // Indice de pousse (0..1) d'une espèce, interpolé entre les points voisins ; null si inconnu
  function wxAt(s, lat, lon) {
    const W = F.wx; if (!W) return null;
    const fi = (lat - W.lat0) / W.step, fj = (lon - W.lon0) / W.step;
    const i0 = Math.floor(fi), j0 = Math.floor(fj), a = fi - i0, b = fj - j0;
    let sum = 0, wsum = 0;
    for (const [di, dj, w] of [[0, 0, (1 - a) * (1 - b)], [0, 1, (1 - a) * b], [1, 0, a * (1 - b)], [1, 1, a * b]]) {
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= W.nr || j >= W.nc || w <= 0) continue;
      const v = W.idx[s][i * W.nc + j]; if (v == null) continue;
      sum += v * w; wsum += w;
    }
    return wsum > 0.05 ? sum / wsum : null;
  }
  function loadTile(k) {
    if (F.tiles.has(k) || !F.have.has(k)) return;
    F.tiles.set(k, { st: 'q' });
    fetch(dataUrl('data/foret/' + k + '.geo?v=' + F.ver)).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(gunzip).then(u => {
      if (u.length !== F.n * F.n) throw new Error('taille ' + u.length);
      F.tiles.set(k, { st: 'ok', d: u }); draw(); changed();
    }).catch(e => { F.tiles.delete(k); log('Forêts ' + k + ' : ' + e.message); });
  }
  function visibleTiles(pad) {
    const b = map.getBounds().pad(pad || 0), out = [];
    for (let la = Math.floor(b.getSouth()); la <= Math.floor(b.getNorth()); la++) for (let lo = Math.floor(b.getWest()); lo <= Math.floor(b.getEast()); lo++) out.push([la, lo]);
    return out;
  }
  function prune() {
    if (F.tiles.size <= 40) return;
    const keep = new Set(visibleTiles(1).map(t => key(t[0], t[1])));
    for (const k of F.tiles.keys()) if (!keep.has(k)) F.tiles.delete(k);
    for (const k of F.img.keys()) if (!keep.has(k.split('|')[0])) F.img.delete(k);
  }

  // ---------- potentiel des cases fines ----------
  const seasonW = () => { const w = S.map(sp => C.seasonOf(sp, MONTH)), any = w.some(v => v > 0); return w.map(ws => (any ? (ws > 0 ? (0.55 + 0.45 * ws) * (ws >= 0.25 ? 1 : ws / 0.25) : 0) : 1)); };
  const LUT = S.map(sp => {
    const a = new Float32Array(32 * 5), e = new Float32Array(4);
    C.GKEYS.forEach((g, i) => { for (let li = 0; li < 5; li++) a[(i + 1) * 5 + li] = (sp.aff[g] || 0) * sp.soil[li]; });
    return { a, e };
  });
  function edgeTables() { S.forEach((sp, s) => { for (let l = 0; l < 4; l++) { const sh = F.edge[l], [t, a] = sp.edge; LUT[s].e[l] = t === 'edge' ? a + (1 - a) * sh : t === 'int' ? 1 - a * sh : 1; } }); }
  function fineImage(la, lo) {
    const k = key(la, lo), t = F.tiles.get(k); if (!t || t.st !== 'ok') return null;
    const soil = o.geolClasses(la, lo);
    const ik = k + '|' + st.mode + '|' + st.sp + '|' + (st.showLow ? 1 : 0) + '|' + (soil ? 1 : 0);
    if (F.img.has(ik)) return F.img.get(ik);
    edgeTables();
    const n = F.n, d = t.d, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d'); if (!g) return null;
    const im = g.createImageData(n, n), px = im.data, gn = soil ? Math.round(Math.sqrt(soil.length)) : 0, gf = gn ? n / gn : 1;
    const bio = st.mode === 'bio', si = S.findIndex(s => s.id === st.sp), f = seasonW(), minLv = st.showLow ? 1 : 2;
    for (let r = 0; r < n; r++) {
      const srow = soil ? Math.floor(r / gf) * gn : 0;
      for (let c = 0; c < n; c++) {
        const v = d[r * n + c]; if (!v) continue;
        const gr = v & 31, lev = v >> 5, o4 = 4 * (r * n + c);
        if (bio) { const col = GROUP_RGB[gr]; if (!col) continue; px[o4] = col[0]; px[o4 + 1] = col[1]; px[o4 + 2] = col[2]; px[o4 + 3] = 168; continue; }
        const li = soil ? soil[srow + Math.floor(c / gf)] : 0, q = gr * 5 + li;
        let p;
        if (si >= 0) p = LUT[si].a[q] * LUT[si].e[lev];
        else {
          let a1 = 0, a2 = 0;
          for (let s = 0; s < NS; s++) { if (!f[s]) continue; let x = LUT[s].a[q] * LUT[s].e[lev]; if (x > 1) x = 1; x *= f[s]; if (x > a1) { a2 = a1; a1 = x; } else if (x > a2) a2 = x; }
          p = (a1 + a2) / 2;
        }
        const lv = C.levelOf(p > 1 ? 1 : p); if (lv < minLv) continue;
        const col = POT_RGB[lv]; px[o4] = col[0]; px[o4 + 1] = col[1]; px[o4 + 2] = col[2]; px[o4 + 3] = lv === 3 ? 215 : lv === 2 ? 140 : 110;
      }
    }
    g.putImageData(im, 0, 0); F.img.set(ik, cv); return cv;
  }

  // ---------- « Ça pousse » de loin : part de bons coins × météo ----------
  // score de chaque case de la carte de France (0..1), selon l'espèce choisie (ou les espèces de saison)
  function scores() {
    const c = F.coarse; if (!c) return null;
    const useWx = wxOn && !!F.wx;
    const sk = st.sp + '|' + (useWx ? 'wx' + F.wx.v : 'nowx') + '|' + MONTH;
    if (F.scores.has(sk)) return F.scores.get(sk);
    const rows = c.rows, cols = c.cols, out = new Float32Array(rows * cols), f = seasonW();
    const list = st.sp !== 'all' ? [S.findIndex(s => s.id === st.sp)].filter(i => i >= 0) : S.map((_, i) => i).filter(i => f[i] > 0);
    const wxc = useWx ? list.map(s => { const a = new Float32Array(rows * cols); for (let r = 0; r < rows; r++) { const lat = c.lat1 - (r + 0.5) / c.n; for (let q = 0; q < cols; q++) { const w = wxAt(s, lat, c.lon0 + (q + 0.5) / c.n); a[r * cols + q] = w == null ? -1 : Math.min(1, w / WX_GOOD); } } return a; }) : null;
    for (let k = 0; k < rows * cols; k++) {
      let a1 = 0, a2 = 0;
      list.forEach((s, li) => {
        const raw = c.L[S[s].id][k]; if (!raw) return;
        const dens = Math.min(1, raw / c.q90[S[s].id]);
        let v = dens * (st.sp !== 'all' ? 1 : f[s]);
        if (wxc) { const w = wxc[li][k]; v *= w < 0 ? 0.5 : w; }
        if (v > a1) { a2 = a1; a1 = v; } else if (v > a2) a2 = v;
      });
      // une espèce : son score ; de saison : moyenne des deux meilleures espèces (comme la carte détaillée)
      out[k] = st.sp !== 'all' ? a1 : (a1 + a2) / 2;
    }
    F.scores.set(sk, out); return out;
  }
  const levelFar = v => (v >= 0.75 ? 3 : v >= 0.45 ? 2 : v >= 0.2 ? 1 : 0);
  function coarseCanvas() {
    const c = F.coarse; if (!c) return null;
    const bio = st.mode === 'bio';
    const ik = 'france|' + st.mode + '|' + st.sp + '|' + (st.showLow ? 1 : 0) + '|' + (wxOn && F.wx ? F.wx.v : 'x');
    if (F.img.has(ik)) return F.img.get(ik);
    const cv = document.createElement('canvas'); cv.width = c.cols; cv.height = c.rows;
    const g = cv.getContext('2d'); if (!g) return null;
    const im = g.createImageData(c.cols, c.rows), px = im.data, sc = bio ? null : scores(), minLv = st.showLow ? 1 : 2;
    for (let k = 0; k < c.rows * c.cols; k++) {
      let col, a;
      if (bio) { const gr = c.L.grp[k], fo = c.L.forest[k] / 255; if (!gr || fo < 0.04) continue; col = GROUP_RGB[gr]; a = Math.round(255 * Math.min(0.8, 0.25 + fo)); }
      else { const lv = levelFar(sc[k]); if (lv < minLv) continue; col = POT_RGB[lv]; a = lv === 3 ? 205 : lv === 2 ? 165 : 130; }
      px[4 * k] = col[0]; px[4 * k + 1] = col[1]; px[4 * k + 2] = col[2]; px[4 * k + 3] = a;
    }
    g.putImageData(im, 0, 0); F.img.set(ik, cv); return cv;
  }

  // ---------- dessin ----------
  function draw() {
    if (!map.hasLayer(layer)) return;
    if (!active()) { layer.clear(); return; }
    layer.draw(ctx => {
      ctx.imageSmoothingEnabled = false;
      if (fine()) {
        for (const [la, lo] of visibleTiles(0.05)) {
          const im = fineImage(la, lo); if (!im) continue;
          const p1 = map.latLngToContainerPoint([la + 1, lo]), p2 = map.latLngToContainerPoint([la, lo + 1]);
          ctx.drawImage(im, p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
      } else {
        const c = F.coarse, im = coarseCanvas(); if (!c || !im) return;
        // une bande par degré de latitude pour suivre la projection de la carte
        const b = map.getBounds();
        for (let la = Math.max(c.lat1 - c.rows / c.n, Math.floor(b.getSouth())); la < Math.min(c.lat1, Math.ceil(b.getNorth())); la++) {
          const r0 = (c.lat1 - la - 1) * c.n, p1 = map.latLngToContainerPoint([la + 1, c.lon0]), p2 = map.latLngToContainerPoint([la, c.lon0 + c.cols / c.n]);
          ctx.drawImage(im, 0, r0, c.cols, c.n, p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        }
      }
    });
  }
  function changed() { if (o.onChange) o.onChange(); }
  function sync() {
    const want = active();
    if (want && !map.hasLayer(layer)) layer.addTo(map); else if (!want && map.hasLayer(layer)) map.removeLayer(layer);
    if (!want) return;
    if (fine()) {
      const vis = visibleTiles(0.15);
      if (vis.length <= 30) { vis.forEach(([la, lo]) => loadTile(key(la, lo))); o.ensureGeol(map.getBounds().pad(0.15)); }
      prune();
    } else { loadCoarse(); loadWx(); }
    if (!F.wxSt) loadWx();
    draw();
  }
  map.on('moveend zoomend', sync);

  // Meilleurs secteurs de la vue (carte de France lissée sur ≈ 15 km), au moins 40 km les uns des autres
  function best(n) {
    const c = F.coarse, sc = c && scores(); if (!sc) return [];
    const b = map.getBounds(), rows = c.rows, cols = c.cols, cand = [];
    const r0 = Math.max(1, Math.floor((c.lat1 - b.getNorth()) * c.n)), r1 = Math.min(rows - 2, Math.ceil((c.lat1 - b.getSouth()) * c.n));
    const q0 = Math.max(1, Math.floor((b.getWest() - c.lon0) * c.n)), q1 = Math.min(cols - 2, Math.ceil((b.getEast() - c.lon0) * c.n));
    for (let r = r0; r <= r1; r++) for (let q = q0; q <= q1; q++) {
      let s = 0; for (let dr = -1; dr <= 1; dr++) for (let dq = -1; dq <= 1; dq++) s += sc[(r + dr) * cols + q + dq] * (dr || dq ? 1 : 2);
      s /= 10; if (s >= 0.3) cand.push({ r, q, s });
    }
    cand.sort((x, y) => y.s - x.s);
    const out = [];
    for (const k of cand) {
      const lat = c.lat1 - (k.r + 0.5) / c.n, lon = c.lon0 + (k.q + 0.5) / c.n;
      if (out.some(p => Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos(lat * Math.PI / 180)) < 0.36)) continue;
      out.push({ lat, lon, score: k.s });
      if (out.length >= n) break;
    }
    return out;
  }
  // Peuplement dominant au point (cases fines déjà chargées), clé de core.GROUPS ou null
  function groupAt(lat, lon) {
    const la = Math.floor(lat), lo = Math.floor(lon), t = F.tiles.get(key(la, lo)); if (!t || t.st !== 'ok') return null;
    const n = F.n, v = t.d[Math.min(n - 1, Math.floor((la + 1 - lat) * n)) * n + Math.min(n - 1, Math.floor((lon - lo) * n))] & 31;
    return v ? C.GKEYS[v - 1] : null;
  }
  return {
    FAR_Z, sync, draw, best, groupAt, wxAt,
    refresh() { F.img.clear(); F.scores.clear(); draw(); },
    setWx(b) { wxOn = !!b; F.scores.clear(); draw(); changed(); },
    get wxOn() { return wxOn; },
    get state() { return { idx: !!F.idx, coarse: F.coarseSt, wxDate: F.wx ? F.wx.v : null, tiles: [...F.tiles.values()].filter(t => t.st === 'ok').length, wait: [...F.tiles.values()].filter(t => t.st === 'q').length }; },
    tileUrls(b) { const out = []; for (let la = Math.floor(b.getSouth()); la <= Math.floor(b.getNorth()); la++) for (let lo = Math.floor(b.getWest()); lo <= Math.floor(b.getEast()); lo++) if (F.have.has(key(la, lo))) out.push(dataUrl('data/foret/' + key(la, lo) + '.geo?v=' + F.ver)); return out; }
  };
}
