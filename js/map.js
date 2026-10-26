// Carte : fonds IGN, BD Forêt en direct, grille de potentiel, mode biotope, couches du jeu, brouillard, hors-ligne.
import { Core as C } from './core.js';
import { FOG, cellBounds } from './game.js';

const L = window.L;
const DATA_Z = 13;
const WFS = 'https://data.geopf.fr/wfs/ows';
const TYPENAMES = ['LANDCOVER.FORESTINVENTORY.V2:formation_vegetale', 'BDFORETV2:formation_vegetale', 'BDFORETV2_BDD_FXX_LAMB93_30-06-2022:formation_vegetale'];
const ESRI = 'https://services.esrifrance.fr/arcgis/rest/services/IGN/FranceDOM_BDFORETv2/FeatureServer/0/query';
const IGN_WMTS = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&TILEMATRIXSET=PM&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}';
const ATTR_IGN = '© <a href="https://www.ign.fr/" target="_blank" rel="noopener">IGN</a>';
export const POT_COL = ['', '#F2B43A', '#E5601A', '#B3103D'];

export function createMap(el, deps) {
  const { GEO, log, toast, store } = deps;
  const MONTH = new Date().getMonth() + 1;
  const st = { sp: 'all', mode: 'pot', showLow: false, base: 'plan', srcErr: null, fog: null };

  // ---------- sol estimé ----------
  function polysToRings(polys) {
    return polys.map(poly => {
      const rings = poly.map(r => { const a = new Float64Array(r.length * 2); r.forEach((p, i) => { a[2 * i] = C.mx(p[0]); a[2 * i + 1] = C.my(p[1]); }); return a; });
      const bb = [Infinity, Infinity, -Infinity, -Infinity];
      rings.forEach(a => { for (let i = 0; i < a.length; i += 2) { bb[0] = Math.min(bb[0], a[i]); bb[2] = Math.max(bb[2], a[i]); bb[1] = Math.min(bb[1], a[i + 1]); bb[3] = Math.max(bb[3], a[i + 1]); } });
      return { rings, bb };
    });
  }
  const LITHO_POLYS = [];
  if (GEO) {
    polysToRings(GEO.dep).forEach(p => LITHO_POLYS.push(Object.assign({ v: 4 }, p)));
    [['gres', 1], ['mixte', 2], ['calc', 3]].forEach(([k, v]) => polysToRings(GEO[k]).forEach(p => LITHO_POLYS.push(Object.assign({ v }, p))));
  }
  function lithoAt(x, y) { let v = 0; for (const Lp of LITHO_POLYS) if (x >= Lp.bb[0] && x <= Lp.bb[2] && y >= Lp.bb[1] && y <= Lp.bb[3] && C.pointInRings(Lp.rings, x, y)) v = Lp.v; return v; }
  function nearestCommune(lat, lon) {
    if (!GEO) return null;
    let best = null, bd = Infinity; const k = Math.cos(lat * Math.PI / 180);
    for (const c of GEO.communes) { const d = (c[1] - lat) ** 2 + ((c[2] - lon) * k) ** 2; if (d < bd) { bd = d; best = c; } }
    return best && bd < 0.0009 ? best[0] : null;
  }

  // ---------- carte et fonds ----------
  const map = L.map(el, { zoomControl: false, minZoom: 7, maxZoom: 18, attributionControl: true });
  map.attributionControl.setPrefix(false);
  map.attributionControl.setPosition('topright');
  map.attributionControl.addAttribution('BD Forêt® © IGN · météo Open-Meteo');
  map.createPane('grid'); map.getPane('grid').style.zIndex = 350; map.getPane('grid').style.pointerEvents = 'none';
  map.createPane('fog'); map.getPane('fog').style.zIndex = 370; map.getPane('fog').style.pointerEvents = 'none';
  map.createPane('people'); map.getPane('people').style.zIndex = 640;
  map.fitBounds([[48.52, 5.89], [49.52, 7.64]]);

  function tileFallback(name, cands, onFail) {
    let i = 0, cur = null, loads = 0, errs = 0, on = false;
    function build() {
      const c = cands[i];
      const lyr = c.wms ? L.tileLayer.wms(c.url, Object.assign({}, c.opt)) : L.tileLayer(c.url, Object.assign({}, c.opt));
      lyr.on('tileload', () => { loads++; });
      lyr.on('tileerror', () => { errs++; if (!loads && errs >= 4) setTimeout(advance, 0); });
      lyr._cc = c;
      return lyr;
    }
    function advance() {
      if (!on || !cur) return;
      map.removeLayer(cur); cur = null; i++; loads = errs = 0;
      if (i < cands.length) { log(name + ' : essai de la source ' + (i + 1)); cur = build().addTo(map); }
      else { on = false; i = 0; log(name + ' : aucune source ne répond'); if (onFail) onFail(); }
    }
    return {
      add() { if (on) return; on = true; loads = errs = 0; cur = build().addTo(map); },
      remove() { on = false; if (cur) map.removeLayer(cur); cur = null; },
      get on() { return on; },
      url(x, y, z) { const c = cands[i] || cands[0]; return c.wms ? null : L.Util.template(c.url, { x, y, z, s: 'a' }); }
    };
  }
  const OSM = { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opt: { maxZoom: 18, maxNativeZoom: 19, attribution: '© contributeurs <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' } };
  const baseFailed = () => { if (navigator.onLine === false) toast('Pas de réseau : le fond de carte n\'est pas en cache pour cette zone.', 6000); else if (deps.onBlocked) deps.onBlocked(); };
  const BASES = {
    plan: tileFallback('Plan IGN', [{ url: IGN_WMTS + '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png', opt: { maxZoom: 18, maxNativeZoom: 18, attribution: ATTR_IGN } }, OSM], baseFailed),
    photo: tileFallback('Photos IGN', [{ url: IGN_WMTS + '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg', opt: { maxZoom: 18, maxNativeZoom: 18, attribution: ATTR_IGN } }, OSM], baseFailed),
    osm: tileFallback('OpenStreetMap', [OSM], baseFailed)
  };
  const GEOL = tileFallback('Géologie BRGM', ['SCAN_H_GEOL50', 'SCAN_D_GEOL50', 'GEOLOGIE'].map(layers => ({ wms: true, url: 'https://geoservices.brgm.fr/geologie', opt: { layers, format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.55, maxZoom: 18, zIndex: 5, attribution: '© <a href="https://www.brgm.fr/" target="_blank" rel="noopener">BRGM</a>' } })), () => { toast('Carte géologique BRGM indisponible.'); if (deps.onLayerFail) deps.onLayerFail('geol'); });
  const ONF = tileFallback('Forêts publiques', [
    { url: IGN_WMTS + '&LAYER=FORETS.PUBLIQUES&STYLE=FORET%20PUBLIQUE&FORMAT=image/png', opt: { maxZoom: 18, maxNativeZoom: 16, opacity: 0.7, zIndex: 6, attribution: ATTR_IGN + ', ONF' } },
    { url: IGN_WMTS + '&LAYER=FORETS.PUBLIQUES&STYLE=normal&FORMAT=image/png', opt: { maxZoom: 18, maxNativeZoom: 16, opacity: 0.7, zIndex: 6, attribution: ATTR_IGN + ', ONF' } },
    { wms: true, url: 'https://data.geopf.fr/wms-v/ows', opt: { layers: 'FORETS.PUBLIQUES', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.7, zIndex: 6, attribution: ATTR_IGN + ', ONF' } },
    { wms: true, url: 'https://data.geopf.fr/wms-r/wms', opt: { layers: 'FORETS.PUBLIQUES', format: 'image/png', transparent: true, version: '1.3.0', opacity: 0.7, zIndex: 6, attribution: ATTR_IGN + ', ONF' } }
  ], () => { toast('Couche des forêts publiques indisponible.'); if (deps.onLayerFail) deps.onLayerFail('onf'); });
  function setBase(k) {
    if (!BASES[k]) k = 'plan';
    Object.entries(BASES).forEach(([key, b]) => { if (key !== k) b.remove(); });
    BASES[k].add(); st.base = k;
  }

  if (GEO) GEO.dep.forEach(poly => L.polygon(poly.map(r => r.map(p => [p[1], p[0]])), { color: '#4A2C8F', weight: 2, opacity: 0.6, fill: false, interactive: false, dashArray: '6 5' }).addTo(map));
  const soilLayer = L.layerGroup();
  if (GEO) {
    const col = { gres: '#B3103D', mixte: '#C77D12', calc: '#2C6FB0' };
    ['gres', 'mixte', 'calc'].forEach(k => GEO[k].forEach(poly => L.polygon(poly.map(r => r.map(p => [p[1], p[0]])), { color: col[k], weight: 2, opacity: 0.9, fillOpacity: 0.06, interactive: false }).addTo(soilLayer)));
  }
  let soilForced = false;
  function syncSoil() { const want = soilForced || map.getZoom() < DATA_Z; if (want && !map.hasLayer(soilLayer)) soilLayer.addTo(map); else if (!want && map.hasLayer(soilLayer)) map.removeLayer(soilLayer); }
  map.on('zoomend', syncSoil);

  // ---------- canevas (grille de potentiel, brouillard) ----------
  const CanvasLayer = L.Layer.extend({
    initialize(pane) { this._pane = pane; },
    onAdd(m) { this._c = L.DomUtil.create('canvas', 'cc-grid'); m.getPane(this._pane).appendChild(this._c); m.on('zoomstart', this._hide, this); },
    onRemove(m) { L.DomUtil.remove(this._c); m.off('zoomstart', this._hide, this); },
    _hide() { if (this._c) this._c.style.visibility = 'hidden'; },
    clear() { if (this._c) { const ctx = this._c.getContext('2d'); if (ctx) ctx.clearRect(0, 0, this._c.width, this._c.height); } },
    draw(fn) {
      const m = this._map, c = this._c; if (!m || !c) return;
      const size = m.getSize(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      L.DomUtil.setPosition(c, m.containerPointToLayerPoint([0, 0]));
      c.width = Math.round(size.x * dpr); c.height = Math.round(size.y * dpr);
      c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
      const ctx = c.getContext('2d'); if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.x, size.y);
      fn(ctx, size); c.style.visibility = 'visible';
    }
  });
  const gridLayer = new CanvasLayer('grid').addTo(map);
  const fogLayer = new CanvasLayer('fog');

  // ---------- couches du jeu ----------
  const layers = {
    finds: L.layerGroup().addTo(map), friends: L.layerGroup().addTo(map), events: L.layerGroup().addTo(map),
    treasures: L.layerGroup().addTo(map), track: L.layerGroup().addTo(map), car: L.layerGroup().addTo(map), me: L.layerGroup().addTo(map), tracks: L.layerGroup()
  };

  // ---------- BD Forêt (IGN Géoplateforme) ----------
  const tiles = new Map(), feats = new Map(), queue = [];
  let active = 0, sourceP = null;
  const n2 = Math.pow(2, DATA_Z), W = 2 * C.HALF;
  const lon2tx = lon => Math.floor((C.mx(lon) + C.HALF) / W * n2);
  const lat2ty = lat => Math.floor((C.HALF - C.my(lat)) / W * n2);
  const tileBB = (x, y) => [x / n2 * W - C.HALF, C.HALF - (y + 1) / n2 * W, (x + 1) / n2 * W - C.HALF, C.HALF - y / n2 * W];

  async function getText(url, ms) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 30000);
    try { const res = await fetch(url, { signal: ctl.signal }); return { ok: res.ok, status: res.status, txt: await res.text() }; } finally { clearTimeout(t); }
  }
  function wfsUrl(src, bb, count, start) {
    if (src.kind === 'esri') return ESRI + '?where=1%3D1&geometry=' + bb.map(v => v.toFixed(1)).join('%2C') + '&geometryType=esriGeometryEnvelope&inSR=3857&spatialRel=esriSpatialRelIntersects&outFields=code_tfv%2Ctfv%2Cessence&returnGeometry=true&outSR=3857&f=geojson&resultRecordCount=' + count + '&resultOffset=' + start;
    const base = WFS + '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=' + encodeURIComponent(src.typename) + '&OUTPUTFORMAT=application%2Fjson&COUNT=' + count + '&STARTINDEX=' + start;
    if (src.crs === '4326') return base + '&SRSNAME=urn:ogc:def:crs:EPSG::4326&BBOX=' + [C.latOf(bb[1]), C.lonOf(bb[0]), C.latOf(bb[3]), C.lonOf(bb[2])].map(v => v.toFixed(6)).join(',') + ',urn:ogc:def:crs:EPSG::4326';
    return base + '&SRSNAME=EPSG:3857&BBOX=' + bb.map(v => v.toFixed(1)).join(',') + ',EPSG:3857';
  }
  async function query(src, bb, count, start) {
    const r = await getText(wfsUrl(src, bb, count, start), 35000);
    const head = r.txt.slice(0, 220).replace(/\s+/g, ' ');
    if (!r.ok) throw new Error('HTTP ' + r.status + ' — ' + head);
    if (/^\s*</.test(r.txt)) { const m = r.txt.match(/<(?:ows:)?ExceptionText>([\s\S]*?)<\/(?:ows:)?ExceptionText>/i); throw new Error('Réponse XML — ' + (m ? m[1].trim().slice(0, 200) : head)); }
    let j; try { j = JSON.parse(r.txt); } catch (e) { throw new Error('Réponse illisible — ' + head); }
    if (j.error) throw new Error('Erreur service — ' + JSON.stringify(j.error).slice(0, 200));
    if (j.type !== 'FeatureCollection' || !Array.isArray(j.features)) throw new Error('Pas une collection GeoJSON — ' + head);
    return j;
  }
  async function discoverTypename() {
    log('Recherche du nom de couche dans le catalogue IGN…');
    const res = await fetch(WFS + '?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities');
    const re0 = /<(?:wfs:)?Name>([^<]*(?:formation_vegetale|FORESTINVENTORY|BDFORET|FORMATIONS-VEGETALES)[^<]*)<\/(?:wfs:)?Name>/gi;
    if (!res.ok || !res.body || !res.body.getReader || typeof TextDecoder === 'undefined') { const t = await res.text(); let m, any = null; while ((m = re0.exec(t))) { if (/V1/i.test(m[1])) continue; if (/formation_vegetale/i.test(m[1]) && /V2|FORESTINVENTORY/i.test(m[1])) return m[1]; any = any || m[1]; } return any; }
    const rd = res.body.getReader(), dec = new TextDecoder();
    let buf = '', total = 0, any = null;
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      total += value.length; buf += dec.decode(value, { stream: true });
      const re = new RegExp(re0.source, 'gi'); let m;
      while ((m = re.exec(buf))) { const nm = m[1]; if (/V1/i.test(nm)) continue; if (/formation_vegetale/i.test(nm) && /V2|FORESTINVENTORY/i.test(nm)) { try { rd.cancel(); } catch (e) { /* ignore */ } return nm; } any = any || nm; }
      buf = buf.slice(-600);
      if (total > 60e6) { try { rd.cancel(); } catch (e) { /* ignore */ } break; }
    }
    return any;
  }
  async function resolveSource(bb) {
    const tries = [], cached = store.get('cc.src', null);
    if (cached && cached.kind) tries.push(cached);
    TYPENAMES.forEach(t => tries.push({ kind: 'wfs', typename: t, crs: '3857' }));
    const seen = new Set();
    for (const s of tries) {
      const k = JSON.stringify(s); if (seen.has(k)) continue; seen.add(k);
      try { await query(s, bb, 1, 0); log('Source forêts : ' + (s.typename || 'Esri France')); store.set('cc.src', s); return s; }
      catch (e) {
        log('Essai ' + (s.typename || s.kind) + ' : ' + e.message);
        if (s.kind === 'wfs' && s.crs === '3857' && /srs|crs|epsg|projection/i.test(e.message)) { const s2 = Object.assign({}, s, { crs: '4326' }); try { await query(s2, bb, 1, 0); store.set('cc.src', s2); return s2; } catch (e2) { log('Essai 4326 : ' + e2.message); } }
      }
    }
    try {
      const t = await discoverTypename();
      if (t) { for (const crs of ['3857', '4326']) { const s = { kind: 'wfs', typename: t, crs }; try { await query(s, bb, 1, 0); log('Source forêts trouvée : ' + t); store.set('cc.src', s); return s; } catch (e) { log('Essai ' + t + ' (' + crs + ') : ' + e.message); } } }
      else log('Aucune couche forestière dans le catalogue');
    } catch (e) { log('Catalogue IGN : ' + e.message); }
    const es = { kind: 'esri' };
    try { await query(es, bb, 1, 0); log('Source forêts : Esri France (secours)'); store.set('cc.src', es); return es; } catch (e) { log('Essai Esri : ' + e.message); }
    throw new Error('Aucune source BD Forêt ne répond');
  }
  function getSource(bb) {
    if (!sourceP) sourceP = resolveSource(bb).then(s => { st.srcErr = null; return s; }, e => { sourceP = null; st.srcErr = e.message; throw e; });
    return sourceP;
  }
  function ingest(fc, bb, hint) {
    const conv = C.toMerc(C.detectMode(fc, bb, hint)), ids = [];
    for (const ft of fc.features) {
      try { const nf = C.normalizeFeature(ft, conv); if (!nf) continue; if (!feats.has(nf.id)) feats.set(nf.id, nf); ids.push(nf.id); } catch (e) { /* objet ignoré */ }
    }
    return ids;
  }
  async function loadTile(t) {
    const bb = tileBB(t.x, t.y);
    try {
      const src = await getSource(bb);
      const ids = [], PAGE = 1000; let start = 0;
      for (let page = 0; page < 20; page++) {
        let fc;
        try { fc = await query(src, bb, PAGE, start); } catch (e) { if (page === 0) store.set('cc.src', null); throw e; }
        ids.push(...ingest(fc, bb, src.kind === 'wfs' && src.crs === '4326' ? 'latlon' : 'merc'));
        const n = fc.features.length; start += n;
        const total = typeof fc.numberMatched === 'number' ? fc.numberMatched : typeof fc.totalFeatures === 'number' ? fc.totalFeatures : null;
        const more = fc.properties && fc.properties.exceededTransferLimit;
        if (!n) break;
        if (total != null) { if (start >= total) break; } else if (!more && n < PAGE) break;
      }
      tiles.set(t.key, { st: 'ok', ids });
    } catch (e) { tiles.set(t.key, { st: 'err', err: e.message }); log('Zone ' + t.key + ' : ' + e.message); }
    scheduleRedraw();
  }
  function nearView(t) {
    if (map.getZoom() < DATA_Z) return false;
    const b = map.getBounds().pad(0.6);
    return t.x >= lon2tx(b.getWest()) && t.x <= lon2tx(b.getEast()) && t.y >= lat2ty(b.getNorth()) && t.y <= lat2ty(b.getSouth());
  }
  function pump() {
    while (active < 3 && queue.length) {
      const t = queue.shift();
      if (!t.force && !nearView(t)) { tiles.delete(t.key); continue; }
      active++;
      loadTile(t).finally(() => { active--; pump(); if (deps.onChange) deps.onChange(); });
    }
  }
  function ensureTiles(bounds, force) {
    if (!force && map.getZoom() < DATA_Z) return [];
    const b = bounds || map.getBounds().pad(0.12), c = b.getCenter();
    const x0 = lon2tx(b.getWest()), x1 = lon2tx(b.getEast()), y0 = lat2ty(b.getNorth()), y1 = lat2ty(b.getSouth());
    const cx = lon2tx(c.lng), cy = lat2ty(c.lat), add = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const key = x + '/' + y; if (!tiles.has(key)) add.push({ x, y, key, force, d: (x - cx) ** 2 + (y - cy) ** 2 }); }
    add.sort((a, b2) => a.d - b2.d).forEach(t => { tiles.set(t.key, { st: 'q' }); queue.push(t); });
    pump(); prune();
    return add;
  }
  function prune() {
    if (feats.size < 14000) return;
    const b = map.getBounds().pad(1), keep = new Set();
    for (const [key, t] of tiles) {
      const [x, y] = key.split('/').map(Number);
      const inside = x >= lon2tx(b.getWest()) && x <= lon2tx(b.getEast()) && y >= lat2ty(b.getNorth()) && y <= lat2ty(b.getSouth());
      if (!inside && t.st !== 'q') { tiles.delete(key); continue; }
      if (t.ids) t.ids.forEach(id => keep.add(id));
    }
    for (const id of feats.keys()) if (!keep.has(id)) feats.delete(id);
  }
  function tileCounts() {
    if (map.getZoom() < DATA_Z) return null;
    const b = map.getBounds(); let ok = 0, err = 0, wait = 0;
    for (let x = lon2tx(b.getWest()); x <= lon2tx(b.getEast()); x++) for (let y = lat2ty(b.getNorth()); y <= lat2ty(b.getSouth()); y++) {
      const t = tiles.get(x + '/' + y); if (!t || t.st === 'q') wait++; else if (t.st === 'ok') ok++; else err++;
    }
    return { ok, err, wait, total: ok + err + wait };
  }
  function retry() { for (const [k, t] of tiles) if (t.st === 'err') tiles.delete(k); sourceP = null; st.srcErr = null; scheduleRedraw(); }

  // ---------- calcul de la grille et rendu ----------
  let G = null, rt = null, statsCache = null;
  function scheduleRedraw() { clearTimeout(rt); rt = setTimeout(redraw, 90); }
  function redraw() {
    const z = map.getZoom();
    if (z < DATA_Z) { G = null; gridLayer.clear(); if (deps.onChange) deps.onChange(); return; }
    ensureTiles();
    const b = map.getBounds(), latRef = Math.round(map.getCenter().lat);
    const cg = C.cellGround(z), cs = cg / Math.cos(latRef * Math.PI / 180);
    const grid = C.makeGrid(C.mx(b.getWest()), C.my(b.getSouth()), C.mx(b.getEast()), C.my(b.getNorth()), cs, 8);
    const gx1 = grid.x0 + grid.nx * cs, gy1 = grid.y0 + grid.ny * cs, list = [];
    for (const f of feats.values()) if (f.bb[2] >= grid.x0 && f.bb[0] <= gx1 && f.bb[3] >= grid.y0 && f.bb[1] <= gy1) list.push(f);
    const lit = LITHO_POLYS.filter(Lp => Lp.bb[2] >= grid.x0 && Lp.bb[0] <= gx1 && Lp.bb[3] >= grid.y0 && Lp.bb[1] <= gy1);
    const known = { z: DATA_Z, has: (x, y) => { const t = tiles.get(x + '/' + y); return !!t && t.st === 'ok'; } };
    const lay = C.computeLayers(grid, list, lit, known);
    const pots = C.potentials(lay, grid, cg);
    G = { z, grid, cg, layers: lay, pots, all: C.bestOf(pots, MONTH, grid.nx * grid.ny), list };
    statsCache = null;
    render();
    if (deps.onChange) deps.onChange();
  }
  function values() { return st.sp === 'all' ? G.all.best : G.pots[C.SPECIES.findIndex(s => s.id === st.sp)] || G.all.best; }
  function render() {
    if (!G || map.getZoom() !== G.z) return;
    const { grid, layers: lay } = G, z = map.getZoom();
    const scale = 256 * Math.pow(2, z) / (2 * C.HALF), cp = grid.cs * scale, gap = cp >= 6 ? 1 : 0, sz = Math.max(1, cp - gap);
    gridLayer.draw((ctx, size) => {
      const pb = map.getPixelBounds();
      const ox = (grid.x0 + C.HALF) * scale - pb.min.x, oyTop = (C.HALF - grid.y0) * scale - pb.min.y, nx = grid.nx, ny = grid.ny;
      if (st.mode === 'bio') {
        ctx.globalAlpha = 0.66;
        for (let j = 0; j < ny; j++) { const py = oyTop - (j + 1) * cp; if (py > size.y || py + cp < 0) continue;
          for (let i = 0; i < nx; i++) { const g = lay.gi[j * nx + i]; if (!g) continue; const px = ox + i * cp; if (px > size.x || px + cp < 0) continue; ctx.fillStyle = C.GROUPS[C.GKEYS[g - 1]].c; ctx.fillRect(px, py, sz, sz); } }
        return;
      }
      const vals = values();
      ctx.globalAlpha = 0.8;
      for (let lv = st.showLow ? 1 : 2; lv <= 3; lv++) {
        ctx.fillStyle = POT_COL[lv];
        const lo = C.LEVELS[lv - 1], hi = lv < 3 ? C.LEVELS[lv] : 9;
        for (let j = 0; j < ny; j++) { const py = oyTop - (j + 1) * cp; if (py > size.y || py + cp < 0) continue;
          for (let i = 0; i < nx; i++) { const v = vals[j * nx + i]; if (v < lo || v >= hi) continue; const px = ox + i * cp; if (px > size.x || px + cp < 0) continue; ctx.fillRect(px, py, sz, sz); } }
      }
    });
  }
  function stats() {
    if (!G) return null;
    if (statsCache && statsCache.G === G && statsCache.sp === st.sp) return statsCache.v;
    const { grid, layers: lay } = G, b = map.getBounds();
    const i0 = Math.max(0, Math.floor((C.mx(b.getWest()) - grid.x0) / grid.cs)), i1 = Math.min(grid.nx - 1, Math.floor((C.mx(b.getEast()) - grid.x0) / grid.cs));
    const j0 = Math.max(0, Math.floor((C.my(b.getSouth()) - grid.y0) / grid.cs)), j1 = Math.min(grid.ny - 1, Math.floor((C.my(b.getNorth()) - grid.y0) / grid.cs));
    const ha = G.cg * G.cg / 10000, vals = values();
    const lv = [0, 0, 0, 0], groups = {}, perSp = C.SPECIES.map(() => 0); let forest = 0, known = 0;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * grid.nx + i; if (!lay.kn[k]) continue; known++;
      const g = lay.gi[k]; if (g) { forest++; groups[g] = (groups[g] || 0) + 1; }
      lv[C.levelOf(vals[k])]++;
      for (let s = 0; s < perSp.length; s++) if (G.pots[s][k] >= C.LEVELS[2]) perSp[s]++;
    }
    const v = { ha, lv, groups, forest, known, perSp };
    statsCache = { G, sp: st.sp, v };
    return v;
  }

  // ---------- analyse d'un point ----------
  function analyze(ll) {
    const x = C.mx(ll.lng), y = C.my(ll.lat);
    const p = { lat: ll.lat, lng: ll.lng, litho: lithoAt(x, y), commune: nearestCommune(ll.lat, ll.lng), k: null, f: null };
    if (G) {
      const i = Math.floor((x - G.grid.x0) / G.grid.cs), j = Math.floor((y - G.grid.y0) / G.grid.cs);
      if (i >= 0 && j >= 0 && i < G.grid.nx && j < G.grid.ny) p.k = j * G.grid.nx + i;
      if (p.k != null && G.layers.fi[p.k] >= 0) p.f = G.list[G.layers.fi[p.k]];
    }
    if (!p.f) for (const ft of feats.values()) if (x >= ft.bb[0] && x <= ft.bb[2] && y >= ft.bb[1] && y <= ft.bb[3] && C.pointInRings(ft.rings, x, y)) { p.f = ft; break; }
    if (G && p.k != null && G.layers.kn[p.k] && G.layers.gi[p.k]) {
      p.edge = G.layers.open[p.k] ? 0 : Math.round(G.layers.dist[p.k] * G.cg);
      p.eco = G.layers.eco[p.k];
      p.pots = C.SPECIES.map((s, i) => ({ id: s.id, n: s.n, v: G.pots[i][p.k], season: C.seasonOf(s, MONTH) }));
      p.cell = G.cg;
    }
    return p;
  }

  // ---------- brouillard d'exploration ----------
  function drawFog() {
    if (!map.hasLayer(fogLayer)) return;
    const cells = st.fog || new Set(), b = map.getBounds().pad(0.05);
    fogLayer.draw((ctx, size) => {
      ctx.fillStyle = 'rgba(28,36,31,0.5)'; ctx.fillRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = '#000';
      const a0 = Math.floor(b.getSouth() / FOG.dlat), a1 = Math.floor(b.getNorth() / FOG.dlat), b0 = Math.floor(b.getWest() / FOG.dlng), b1 = Math.floor(b.getEast() / FOG.dlng);
      const big = (a1 - a0 + 1) * (b1 - b0 + 1) > cells.size;
      const each = key => { const c = cellBounds(key); const p1 = map.latLngToContainerPoint([c[2], c[1]]), p2 = map.latLngToContainerPoint([c[0], c[3]]); const r = Math.max(p2.x - p1.x, p2.y - p1.y) * 0.85; ctx.beginPath(); ctx.arc((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, r, 0, Math.PI * 2); ctx.fill(); };
      if (big) { for (const key of cells) { const [a, bb] = key.split(':').map(Number); if (a >= a0 && a <= a1 && bb >= b0 && bb <= b1) each(key); } }
      else for (let a = a0; a <= a1; a++) for (let bb = b0; bb <= b1; bb++) { const key = a + ':' + bb; if (cells.has(key)) each(key); }
      ctx.globalCompositeOperation = 'source-over';
    });
  }
  function setFog(cells) {
    st.fog = cells;
    if (cells && !map.hasLayer(fogLayer)) fogLayer.addTo(map);
    if (!cells && map.hasLayer(fogLayer)) map.removeLayer(fogLayer);
    drawFog();
  }

  // ---------- hors-ligne : adresses des tuiles d'une zone ----------
  function tileUrls(bounds, zmin, zmax, max) {
    const urls = [];
    for (let z = zmin; z <= zmax; z++) {
      const n = Math.pow(2, z), tx = lon => Math.floor((lon + 180) / 360 * n), ty = lat => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
      for (let x = tx(bounds.getWest()); x <= tx(bounds.getEast()); x++) for (let y = ty(bounds.getNorth()); y <= ty(bounds.getSouth()); y++) {
        const u = BASES[st.base].url(x, y, z); if (u) urls.push(u);
        if (urls.length > max) return null;
      }
    }
    return urls;
  }
  async function prefetchForests(bounds, onProgress) {
    const add = ensureTiles(bounds, true);
    const keys = add.map(t => t.key);
    const total = keys.length || 1;
    return new Promise(resolve => {
      const tick = () => { const done = keys.filter(k => { const t = tiles.get(k); return t && t.st !== 'q'; }).length; if (onProgress) onProgress(done, total); if (done >= keys.length) resolve(keys.length); else setTimeout(tick, 500); };
      tick();
    });
  }

  map.on('moveend', () => { scheduleRedraw(); drawFog(); });
  map.on('click', e => { if (deps.onTap) deps.onTap(e.latlng); });
  syncSoil();

  return {
    map, L, C, layers, DATA_Z, POT_COL, feats, tiles,
    get G() { return G; }, get st() { return st; },
    setMode(m) { st.mode = m; el.classList.toggle('mode-bio', m === 'bio'); el.classList.toggle('mode-pot', m !== 'bio'); render(); statsCache = null; },
    setSpecies(id) { st.sp = id; statsCache = null; render(); },
    setShowLow(b) { st.showLow = !!b; render(); },
    setBase, redraw, scheduleRedraw, render, stats, tileCounts, retry, analyze, setFog, drawFog,
    setSoil(on) { soilForced = !!on; syncSoil(); },
    setGeol(on) { if (on) GEOL.add(); else GEOL.remove(); },
    setOnf(on) { if (on) ONF.add(); else ONF.remove(); },
    resetSource() { store.set('cc.src', null); retry(); },
    tileUrls, prefetchForests, nearestCommune, lithoAt: (lat, lng) => lithoAt(C.mx(lng), C.my(lat))
  };
}
