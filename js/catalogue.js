// Catalogue des champignons de France (data/catalogue, construit chaque mois par tools/catalogue/build.mjs) :
// toutes les espèces de TAXREF qui ont un nom français, recherche sans accents et tolérante aux fautes,
// détails par paquets (résumé Wikipédia, photos, classification), départements où l'espèce est observée.
// La comestibilité n'est jamais donnée ici : seules les fiches vérifiées de l'encyclopédie (encyclo.js) la donnent.
import { ENCYCLO } from './encyclo.js';

export const norm = s => String(s || '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const SMALL = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'en', 'a', 'au', 'aux', 'd', 'l', 'et', 'a']);

// noms latins d'une fiche : « Morchella esculenta, M. elata » → Morchella esculenta, Morchella elata
export function latNames(lat) {
  const out = []; let genus = '';
  for (let p of String(lat || '').split(/[,;]| et /)) {
    p = p.replace(/\(.*?\)/g, '').replace(/…|\.\.\./g, '').replace(/\b(forme|var\.|f\.|s\.l\.|s\.s\.|sensu lato|groupe)\b.*$/i, '').trim();
    const m = p.match(/^([A-Z][a-z]+|[A-Z]\.)\s+([a-z-]+)/); if (!m) continue;
    if (m[1].endsWith('.')) { if (genus) out.push(genus + ' ' + m[2]); } else { genus = m[1]; out.push(m[1] + ' ' + m[2]); }
  }
  return out;
}

// distance d'édition (avec inversion de deux lettres), arrêt dès que la limite est dépassée
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v); if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
// un mot tapé ressemble au début d'un mot du nom ? (renvoie le nombre de fautes, ou -1)
function fuzzyWord(t, words) {
  const max = t.length <= 3 ? 0 : t.length <= 5 ? 1 : 2;
  let best = -1;
  for (const w of words) {
    if (w.startsWith(t)) return 0;
    if (!max) continue;
    for (let L = Math.max(1, t.length - 1); L <= t.length + 1; L++) {
      if (L > w.length + 1) break;
      const d = dist(t, w.slice(0, L), max);
      if (d <= max && (best < 0 || d < best)) best = d;
    }
  }
  return best;
}
// document de recherche : nom principal, autres noms, nom latin, anciens noms
export function doc(o) {
  o.kN = norm(o.n); o.kA = (o.alt || []).map(norm); o.kL = norm(o.lat); o.kS = (o.syn || []).map(norm);
  o.wN = o.kN.split(' ');
  o.words = [...new Set([o.kN, ...o.kA, o.kL, ...o.kS].join(' ').split(' ').filter(Boolean))];
  o.hay = ' ' + [o.kN, ...o.kA, o.kL, ...o.kS].join(' | ') + ' ';
  return o;
}
export function score(o, qn, toks) {
  let s = 0;
  if (o.kN === qn) s = 1000;
  else if (o.kA.includes(qn) || o.kL === qn) s = 920;
  else if (o.kN.startsWith(qn)) s = 820;
  else if (o.kA.some(a => a.startsWith(qn)) || o.kL.startsWith(qn)) s = 720;
  else if (toks.every(t => o.wN.some(w => w.startsWith(t)))) s = 620;
  else if (o.kS.some(x => x === qn || x.startsWith(qn))) s = 560;
  else if (toks.every(t => o.words.some(w => w.startsWith(t)))) s = 480;
  else if (o.hay.includes(qn)) s = 320;
  return s;
}
export function fuzzyScore(o, toks) {
  let tot = 0, used = 0;
  for (const t of toks) {
    if (SMALL.has(t)) continue;
    const d = fuzzyWord(t, o.words); if (d < 0) return 0;
    tot += d; used++;
  }
  return used ? 220 - 45 * tot : 0;
}
const pop = o => Math.log10((o.obs || 0) + 1) * 14;

export function createCatalogue({ dataUrl }) {
  const C = { st: null, v: '', list: [], byId: new Map(), byLat: new Map(), ficheIds: new Map(), dep: [], depIdx: new Map(), chunks: new Map(), waiting: [] };

  function parse(j) {
    C.v = j.v; C.gen = j.gen; C.chunk = j.chunk || 60; C.dep = j.dep || [];
    C.depIdx = new Map(C.dep.map(([code], i) => [code, i]));
    C.list = j.sp.map((r, i) => {
      const [num, n, alt, lat, syn, fl, mo, obs, ph, dep] = r;
      return doc({ id: 't' + num, num, n, alt: alt ? alt.split('|') : [], lat, syn: syn ? syn.split('|') : [], tox: /m/.test(fl) ? 'm' : /t/.test(fl) ? 't' : '', risk: /g/.test(fl) ? 'g' : /r/.test(fl) ? 'r' : '',
        mo: mo ? [...mo].map(Number) : null, obs: obs || 0, ph: ph || '', dep: dep || '', chunk: Math.floor(i / C.chunk) });
    });
    C.byId = new Map(C.list.map(e => [e.id, e]));
    // noms latins → espèce (le nom retenu d'abord, puis les anciens noms)
    C.byLat = new Map();
    for (const e of C.list) if (!C.byLat.has(e.kL)) C.byLat.set(e.kL, e);
    for (const e of C.list) for (const s of e.kS) if (!C.byLat.has(s)) C.byLat.set(s, e);
    // fiches vérifiées ↔ espèces du catalogue
    C.ficheIds = new Map();
    for (const f of ENCYCLO) {
      const ids = [];
      // nom latin de la fiche, puis noms latins cités dans ses autres noms (anciens noms)
      for (const name of latNames(f.lat).concat(latNames(f.alias))) { const e = C.byLat.get(norm(name)); if (e && !e.fiche) { e.fiche = f.id; e.game = f.game; ids.push(e.id); } }
      C.ficheIds.set(f.id, ids);
    }
  }
  function load() {
    if (C.st === 'ok') return Promise.resolve(C);
    if (C.p) return C.p;
    C.st = 'q';
    C.p = fetch(dataUrl('data/catalogue/index.json')).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(j => { parse(j); C.st = 'ok'; return C; })
      .catch(e => { C.st = 'err'; C.p = null; throw e; });
    return C.p;
  }
  // détails d'une espèce (paquet de 60 espèces, gardé hors réseau par le service worker)
  function detail(id) {
    const e = C.byId.get(id); if (!e) return Promise.resolve(null);
    if (C.chunks.has(e.chunk)) return Promise.resolve((C.chunks.get(e.chunk).sp || {})[e.num] || null);
    return fetch(dataUrl('data/catalogue/d/' + e.chunk + '.json') + '?v=' + C.v).then(r => (r.ok ? r.json() : null))
      .then(j => { if (j) C.chunks.set(e.chunk, j); return j && j.sp ? j.sp[e.num] || null : null; }).catch(() => null);
  }
  // recherche : toutes les espèces, triées par pertinence puis par nombre d'observations
  function search(q, opt = {}) {
    const qn = norm(q); if (!qn || C.st !== 'ok') return [];
    const toks = qn.split(' '), lim = opt.limit || 60, flt = opt.filter;
    const res = [];
    for (const e of C.list) {
      if (flt && !flt(e)) continue;
      const s = score(e, qn, toks); if (s) res.push([s + pop(e), e]);
    }
    if (res.length < 12 && qn.length >= 4) {
      const seen = new Set(res.map(x => x[1]));
      for (const e of C.list) {
        if (seen.has(e) || (flt && !flt(e))) continue;
        const s = fuzzyScore(e, toks); if (s > 0) res.push([s + pop(e) * 0.5, e]);
      }
    }
    res.sort((a, b) => b[0] - a[0]);
    return res.slice(0, lim).map(x => Object.assign(x[1], { _s: x[0] }));
  }
  // photos : Wikimedia Commons (c : vignette de 330 px, o : image d'origine) ou iNaturalist (i)
  function thumb(e) {
    const p = e && e.ph; if (!p) return null;
    if (p[0] === 'c') { const path = p.slice(1); return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + path + '/330px-' + path.split('/').pop(); }
    if (p[0] === 'o') return 'https://upload.wikimedia.org/wikipedia/commons/' + p.slice(1);
    if (p[0] === 'i') { const [pid, ext] = p.slice(1).split('.'); return 'https://inaturalist-open-data.s3.amazonaws.com/photos/' + pid + '/small.' + ext; }
    return null;
  }
  // départements : bit n° i de e.dep (base64) = département C.dep[i]
  function inDep(e, code) {
    const i = C.depIdx.get(code); if (i == null || !e.dep) return false;
    const s = e.dep.replace(/-/g, '+').replace(/_/g, '/'); let bin;
    try { bin = atob(s + '==='.slice((s.length + 3) % 4)); } catch (err) { return false; }
    return !!(bin.charCodeAt(i >> 3) & (1 << (i & 7)));
  }
  const depName = code => { const d = C.dep.find(x => x[0] === code); return d ? d[1] : code; };
  const inSeason = (e, month) => !!e.mo && e.mo[month - 1] >= 5;
  return { C, load, detail, search, thumb, inDep, depName, inSeason, get: id => C.byId.get(id) || null, fichesOf: fid => C.ficheIds.get(fid) || [] };
}
