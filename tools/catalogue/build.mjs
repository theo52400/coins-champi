// Catalogue des champignons de France pour l'encyclopédie et les trouvailles.
// Toutes les espèces de champignons de TAXREF (référentiel national, publié sur GBIF) qui ont un nom français,
// hors lichens, rouilles, charbons, oïdiums, levures et moisissures. Pour chacune :
//  - noms français, nom latin retenu et anciens noms (synonymes) ;
//  - observations en France (GBIF) : nombre, mois, départements ;
//  - résumé de Wikipédia (sans les phrases sur la comestibilité : l'appli ne la donne que sur ses fiches vérifiées) ;
//  - une ou deux photos libres (Wikimedia Commons, sinon iNaturalist sous CC0 / CC BY) ;
//  - signalements de toxicité (Wikidata, Wikipédia) et genres à espèces mortelles.
// Écrit <dossier>/index.json (recherche), <dossier>/d/<n>.json (détails par paquets) et <dossier>/rapport.txt.
// Usage : node build.mjs <dossier>
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const OUT = process.argv[2] || 'data/catalogue';
const UA = 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi; encyclopedie libre des champignons)';
const TAXREF = '0e61f8fe-7d25-4f81-ada7-d970bbb2c6d6';   // TAXREF sur GBIF
const INAT = '50c9509d-22c7-4a22-a47d-8c48425ef4a7';     // iNaturalist, observations de recherche
const CHUNK = 60;
const log = [];
const say = (...a) => { const s = a.join(' '); console.log(s); log.push(s); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- réseau
async function get(url, opt = {}) {
  for (let k = 0; k < 7; k++) {
    try {
      const r = await fetch(url, Object.assign({ headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, opt.headers || {}) }, opt.init || {}));
      if (r.ok) return opt.text ? await r.text() : await r.json();
      if (r.status === 404 || r.status === 400) return null;
    } catch (e) { /* réessai */ }
    await sleep(800 * 2 ** k);
  }
  return null;
}
async function pool(items, n, fn) {
  let i = 0, done = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); if (++done % 500 === 0) console.log('  …', done, '/', items.length); }
  }));
  return out;
}
const gbif = p => get('https://api.gbif.org/v1/' + p);
const qs = o => Object.entries(o).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');

// ---------------------------------------------------------------- 1. TAXREF : espèces de champignons à nom français
// on écarte les lichens, les rouilles, charbons, oïdiums, cloques, levures, moisissures et micro-champignons des feuilles,
// d'après n'importe quel rang de la classification (certaines espèces de TAXREF n'ont pas de classe renseignée)
const DROP = new Set(['Lecanoromycetes', 'Arthoniomycetes', 'Lichinomycetes', 'Candelariomycetes', 'Coniocybomycetes', 'Dothideomycetes', 'Taphrinomycetes',
  'Saccharomycetes', 'Pucciniomycetes', 'Ustilaginomycetes', 'Exobasidiomycetes', 'Microbotryomycetes', 'Laboulbeniomycetes', 'Chytridiomycota', 'Mucoromycota',
  'Zoopagomycota', 'Glomeromycota', 'Blastocladiomycota', 'Microsporidia', 'Cryptomycota', 'Entomophthoromycota',
  'Lecanorales', 'Peltigerales', 'Teloschistales', 'Ostropales', 'Pertusariales', 'Umbilicariales', 'Caliciales', 'Arthoniales', 'Verrucariales', 'Lichinales',
  'Baeomycetales', 'Acarosporales', 'Candelariales', 'Gyalectales', 'Lecideales', 'Rhizocarpales', 'Trapeliales', 'Agyriales', 'Graphidales', 'Pyrenulales',
  'Sarrameanales', 'Lichenomphaliales', 'Pucciniales', 'Uredinales', 'Septobasidiales', 'Ustilaginales', 'Urocystidales', 'Entylomatales', 'Tilletiales', 'Exobasidiales', 'Microbotryales',
  'Taphrinales', 'Erysiphales', 'Rhytismatales', 'Phacidiales', 'Capnodiales', 'Pleosporales', 'Mycosphaerellales', 'Hysteriales', 'Mytilinidiales',
  'Dothideales', 'Botryosphaeriales', 'Venturiales', 'Eurotiales', 'Onygenales', 'Chaetothyriales', 'Saccharomycetales', 'Mucorales', 'Peronosporales']);
const keepTaxon = r => {
  const names = [r.phylum, r.class, r.order, r.family, ...Object.values(r.higherClassificationMap || {})].filter(Boolean);
  if (names.includes('Elaphomycetaceae') || names.includes('Elaphomycetales')) return true;   // truffes des cerfs
  if (names.includes('Eurotiomycetes')) return false;
  return !names.some(n => DROP.has(n));
};
const kingdoms = await gbif('species/search?' + qs({ datasetKey: TAXREF, rank: 'KINGDOM', limit: 20 }));
const FUNGI = kingdoms.results.find(k => /^Fungi/.test(k.scientificName)).key;
const accepted = [];
for (let off = 0; ; off += 1000) {
  const p = await gbif('species/search?' + qs({ datasetKey: TAXREF, higherTaxonKey: FUNGI, rank: 'SPECIES', status: 'ACCEPTED', limit: 1000, offset: off }));
  if (!p) throw new Error('TAXREF illisible à ' + off);
  accepted.push(...p.results);
  if (p.endOfRecords || !p.results.length) break;
}
say('TAXREF (GBIF) : ' + accepted.length + ' espèces de champignons acceptées');
const byClass = {};
const frName = r => (r.vernacularNames || []).filter(v => v.language === 'fra').flatMap(v => String(v.vernacularName).split(/\s*[,;]\s*/)).map(s => s.trim()).filter(Boolean);
let SP = [];
for (const r of accepted) {
  const fr = [...new Set(frName(r))];
  if (!fr.length) continue;
  const cls = r.class || r.order || '?';
  const keep = keepTaxon(r);
  byClass[cls] = byClass[cls] || [0, 0]; byClass[cls][keep ? 0 : 1]++;
  if (!keep || !r.taxonID) continue;
  SP.push({ id: +r.taxonID, key: r.key, nub: r.nubKey, lat: r.canonicalName, auth: r.authorship || '', genus: r.genus || '', fam: r.family || '', ord: r.order || '', cls,
    fr: fr.map(s => s.charAt(0).toUpperCase() + s.slice(1)), syn: [] });
}
say('Avec un nom français, par classe ou ordre (gardées / écartées) : ' + Object.entries(byClass).sort((a, b) => b[1][0] + b[1][1] - a[1][0] - a[1][1]).map(([c, [a, b]]) => c + ' ' + a + '/' + b).join(', '));
say('Espèces gardées : ' + SP.length);
const BYKEY = new Map(SP.map(s => [s.key, s]));

// anciens noms : les synonymes de chaque espèce
let nsyn = 0;
await pool(SP, 8, async s => {
  const p = await gbif('species/' + s.key + '/synonyms?limit=100');
  for (const r of (p && p.results) || []) {
    if (r.canonicalName && r.canonicalName !== s.lat && /^\S+ \S+$/.test(r.canonicalName) && !s.syn.includes(r.canonicalName)) { s.syn.push(r.canonicalName); nsyn++; }
  }
});
say('Anciens noms latins rattachés : ' + nsyn);

// ---------------------------------------------------------------- 2. GBIF : observations en France
// clé de l'espèce dans la taxonomie de GBIF (le nom retenu par TAXREF, sinon un de ses synonymes)
await pool(SP, 8, async s => {
  for (const name of [s.lat, ...s.syn.slice(0, 3)]) {
    const m = await gbif('species/match?' + qs({ name, kingdom: 'Fungi', strict: 'true' }));
    if (m && m.matchType !== 'NONE' && (m.rank === 'SPECIES' || m.rank === 'SUBSPECIES' || m.rank === 'VARIETY')) { s.g = m.speciesKey || m.acceptedUsageKey || m.usageKey; return; }
  }
});
say('Rattachées à GBIF : ' + SP.filter(s => s.g).length);
const GADM = new Map();
await pool(SP, 8, async s => {
  if (!s.g) { s.n = 0; return; }
  const r = await gbif('occurrence/search?' + qs({ country: 'FR', taxonKey: s.g, limit: 0, facetLimit: 200 }) + '&facet=month&facet=gadmLevel2Gid');
  s.n = r ? r.count : 0;
  const f = Object.fromEntries(((r && r.facets) || []).map(x => [x.field, x.counts]));
  s.mo = new Array(12).fill(0); for (const c of f.MONTH || []) s.mo[+c.name - 1] = c.count;
  s.dg = (f.GADM_LEVEL_2_GID || []).map(c => c.name); for (const g of s.dg) GADM.set(g, null);
});
say('Avec au moins une observation en France : ' + SP.filter(s => s.n > 0).length + ' ; observations au total : ' + SP.reduce((a, s) => a + s.n, 0));

// départements : identifiants GADM → numéro INSEE
const DEP = [['01', 'Ain'], ['02', 'Aisne'], ['03', 'Allier'], ['04', 'Alpes-de-Haute-Provence'], ['05', 'Hautes-Alpes'], ['06', 'Alpes-Maritimes'], ['07', 'Ardèche'], ['08', 'Ardennes'], ['09', 'Ariège'], ['10', 'Aube'], ['11', 'Aude'], ['12', 'Aveyron'], ['13', 'Bouches-du-Rhône'], ['14', 'Calvados'], ['15', 'Cantal'], ['16', 'Charente'], ['17', 'Charente-Maritime'], ['18', 'Cher'], ['19', 'Corrèze'], ['2A', 'Corse-du-Sud'], ['2B', 'Haute-Corse'], ['21', 'Côte-d\'Or'], ['22', 'Côtes-d\'Armor'], ['23', 'Creuse'], ['24', 'Dordogne'], ['25', 'Doubs'], ['26', 'Drôme'], ['27', 'Eure'], ['28', 'Eure-et-Loir'], ['29', 'Finistère'], ['30', 'Gard'], ['31', 'Haute-Garonne'], ['32', 'Gers'], ['33', 'Gironde'], ['34', 'Hérault'], ['35', 'Ille-et-Vilaine'], ['36', 'Indre'], ['37', 'Indre-et-Loire'], ['38', 'Isère'], ['39', 'Jura'], ['40', 'Landes'], ['41', 'Loir-et-Cher'], ['42', 'Loire'], ['43', 'Haute-Loire'], ['44', 'Loire-Atlantique'], ['45', 'Loiret'], ['46', 'Lot'], ['47', 'Lot-et-Garonne'], ['48', 'Lozère'], ['49', 'Maine-et-Loire'], ['50', 'Manche'], ['51', 'Marne'], ['52', 'Haute-Marne'], ['53', 'Mayenne'], ['54', 'Meurthe-et-Moselle'], ['55', 'Meuse'], ['56', 'Morbihan'], ['57', 'Moselle'], ['58', 'Nièvre'], ['59', 'Nord'], ['60', 'Oise'], ['61', 'Orne'], ['62', 'Pas-de-Calais'], ['63', 'Puy-de-Dôme'], ['64', 'Pyrénées-Atlantiques'], ['65', 'Hautes-Pyrénées'], ['66', 'Pyrénées-Orientales'], ['67', 'Bas-Rhin'], ['68', 'Haut-Rhin'], ['69', 'Rhône'], ['70', 'Haute-Saône'], ['71', 'Saône-et-Loire'], ['72', 'Sarthe'], ['73', 'Savoie'], ['74', 'Haute-Savoie'], ['75', 'Paris'], ['76', 'Seine-Maritime'], ['77', 'Seine-et-Marne'], ['78', 'Yvelines'], ['79', 'Deux-Sèvres'], ['80', 'Somme'], ['81', 'Tarn'], ['82', 'Tarn-et-Garonne'], ['83', 'Var'], ['84', 'Vaucluse'], ['85', 'Vendée'], ['86', 'Vienne'], ['87', 'Haute-Vienne'], ['88', 'Vosges'], ['89', 'Yonne'], ['90', 'Territoire de Belfort'], ['91', 'Essonne'], ['92', 'Hauts-de-Seine'], ['93', 'Seine-Saint-Denis'], ['94', 'Val-de-Marne'], ['95', 'Val-d\'Oise']];
const flat = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const DEPBYNAME = new Map(DEP.map(([c, n], i) => [flat(n), i]));
DEPBYNAME.set(flat('Ville de Paris'), DEPBYNAME.get('paris')); DEPBYNAME.set(flat('Territoire-de-Belfort'), DEPBYNAME.get(flat('Territoire de Belfort')));
const gids = [...GADM.keys()];
await pool(gids, 4, async g => { const r = await gbif('geocode/gadm/' + g); GADM.set(g, r ? DEPBYNAME.get(flat(r.name)) : undefined); if (r && GADM.get(g) == null && /^FRA\./.test(g)) say('département inconnu : ' + g + ' ' + r.name); });
const b64 = bytes => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
for (const s of SP) {
  const bits = new Uint8Array(12); let nd = 0;
  for (const g of s.dg || []) { const i = GADM.get(g); if (i != null && !(bits[i >> 3] & (1 << (i & 7)))) { bits[i >> 3] |= 1 << (i & 7); nd++; } }
  s.dep = nd ? b64(bits) : ''; s.nd = nd;
}

// ---------------------------------------------------------------- 3. Wikidata : article Wikipédia, image, toxicité
const sparql = async q => {
  const t = await get('https://query.wikidata.org/sparql?' + qs({ query: q, format: 'json' }), { headers: { Accept: 'application/sparql-results+json' } });
  return (t && t.results && t.results.bindings) || [];
};
const WD = new Map(); // id TAXREF → { q, img, wp, ed: Set }
const take = (s, b) => {
  const w = WD.get(s.id) || { ed: new Set(), img: [] }; WD.set(s.id, w);
  if (b.i) w.q = b.i.value.split('/').pop();
  if (b.img && !w.img.includes(b.img.value)) w.img.push(b.img.value);
  if (b.art) w.wp = decodeURIComponent(b.art.value.split('/wiki/')[1]).replace(/_/g, ' ');
  if (b.ed) w.ed.add(b.ed.value.split('/').pop());
};
const BYID = new Map(SP.map(s => [s.id, s]));
for (let i = 0; i < SP.length; i += 300) {
  const part = SP.slice(i, i + 300);
  const rows = await sparql('SELECT ?t ?i ?img ?art ?ed WHERE { VALUES ?t {' + part.map(s => '"' + s.id + '"').join(' ') + '} ?i wdt:P3186 ?t . OPTIONAL { ?i wdt:P18 ?img } OPTIONAL { ?i wdt:P789 ?ed } OPTIONAL { ?art schema:about ?i ; schema:isPartOf <https://fr.wikipedia.org/> } }');
  for (const b of rows) { const s = BYID.get(+b.t.value); if (s) take(s, b); }
  await sleep(300);
}
// espèces sans identifiant TAXREF sur Wikidata : par la clé GBIF
const rest = SP.filter(s => !WD.has(s.id) && s.g);
const BYG = new Map(rest.map(s => [String(s.g), s]));
for (let i = 0; i < rest.length; i += 300) {
  const part = rest.slice(i, i + 300);
  const rows = await sparql('SELECT ?t ?i ?img ?art ?ed WHERE { VALUES ?t {' + part.map(s => '"' + s.g + '"').join(' ') + '} ?i wdt:P846 ?t . OPTIONAL { ?i wdt:P18 ?img } OPTIONAL { ?i wdt:P789 ?ed } OPTIONAL { ?art schema:about ?i ; schema:isPartOf <https://fr.wikipedia.org/> } }');
  for (const b of rows) { const s = BYG.get(b.t.value); if (s) take(s, b); }
  await sleep(300);
}
say('Wikidata : ' + WD.size + ' espèces, dont ' + [...WD.values()].filter(w => w.wp).length + ' avec un article sur Wikipédia en français');
// sens des valeurs de « comestibilité » (P789)
const edq = [...new Set([...WD.values()].flatMap(w => [...w.ed]))];
const EDL = new Map();
if (edq.length) for (const b of await sparql('SELECT ?e ?l WHERE { VALUES ?e {' + edq.map(q => 'wd:' + q).join(' ') + '} ?e rdfs:label ?l FILTER(LANG(?l)="en") }')) EDL.set(b.e.value.split('/').pop(), b.l.value);
say('Valeurs de comestibilité sur Wikidata : ' + [...EDL.entries()].map(([q, l]) => q + ' ' + l).join(' ; '));

// ---------------------------------------------------------------- 4. Wikipédia : résumé (sans comestibilité) et image principale
const EAT = /comestib|consomm|culinair|cuisin|d[ée]gust|savoureu|d[ée]licieu|gastronom|se mange|mangeable|recherch[ée]+ (?:pour|des|par)|excellent|appr[ée]ci[ée]|march[ée]s?\b|r[ée]colt|cueill|saveur|go[uû]t|recette|frit|po[êe]l|s[ée]ch[ée]|conserv|cultiv/i;
const TOXW = /\b(toxique|v[ée]n[ée]neu|mortel|mortelle|intoxication|empoisonn|hallucino|psychotrope|syndrome)/i;
const NEG = /\b(non|pas|peu|aucun[e]?|ni)\s+(tr[eè]s\s+)?(toxique|v[ée]n[ée]neu|mortel)/i;
const titles = [...new Set([...WD.values()].map(w => w.wp).filter(Boolean))];
const WP = new Map();
for (let i = 0; i < titles.length; i += 20) {
  const part = titles.slice(i, i + 20);
  const j = await get('https://fr.wikipedia.org/w/api.php?' + qs({ action: 'query', format: 'json', formatversion: 2, prop: 'extracts|pageimages', exintro: 1, explaintext: 1, exlimit: 20, piprop: 'name', redirects: 1, titles: part.join('|') }));
  const pages = (j && j.query && j.query.pages) || [], redir = new Map(((j && j.query && j.query.redirects) || []).map(r => [r.to, r.from]));
  const norm = new Map(((j && j.query && j.query.normalized) || []).map(r => [r.to, r.from]));
  for (const p of pages) {
    let t = p.title; t = redir.get(t) || t; t = norm.get(t) || t;
    WP.set(t, { ex: p.extract || '', img: p.pageimage ? 'File:' + p.pageimage.replace(/_/g, ' ') : null, title: p.title });
  }
  await sleep(150);
}
say('Résumés Wikipédia : ' + [...WP.values()].filter(w => w.ex).length);
const sentences = t => String(t || '').replace(/\s+/g, ' ').replace(/\[\d+\]/g, '').match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [];
const CONF = /confon|confus|ressembl|sosie|proche d|distingu|diff[ée]ren|voisin|[àa] ne pas/i;
function summary(ex) {
  const out = [], tox = []; let flag = false;
  for (let s of sentences(ex)) {
    s = s.trim(); if (!s) continue;
    const isTox = TOXW.test(s) && !NEG.test(s), conf = CONF.test(s);
    if (isTox && !conf) flag = true;              // toxicité de l'espèce elle-même (pas d'un sosie)
    if (EAT.test(s)) continue;                     // comestibilité, cuisine : jamais dans le catalogue
    if (isTox && !conf) tox.push(s);
    if ((out.join(' ') + ' ' + s).length > 650) break;
    out.push(s);
  }
  return { text: out.join(' '), tox: tox.join(' ').slice(0, 400), flag };
}

// ---------------------------------------------------------------- 5. photos libres
const FREE = /^(cc0|cc[ -]by(-sa)?[ -]?[\d.]*|public domain|pd|domaine public)/i;
const BAD = /spore|micro|cystid|basid|hyph|drawing|illustration|plate|planche|herbari|stamp|briefmarke|timbre|\bmap\b|range|distribution|\.svg|sowerby|bulliard|krombholz|icon|painting|museum|dried|getrocknet|market|markt|dish|food|soup|recipe|cooking|in.?vitro|culture|mycel|logo|book|page|scan/i;
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const fileOf = u => { try { return 'File:' + decodeURIComponent(u.split('Special:FilePath/')[1] || '').replace(/_/g, ' '); } catch (e) { return null; } };
for (const s of SP) {
  const w = WD.get(s.id), p = w && w.wp && WP.get(w.wp);
  s.cand = [...new Set([p && p.img, ...((w && w.img) || []).map(fileOf)].filter(Boolean))].filter(f => !BAD.test(f)).slice(0, 3);
}
const files = [...new Set(SP.flatMap(s => s.cand))];
const CI = new Map();
for (let i = 0; i < files.length; i += 40) {
  const part = files.slice(i, i + 40);
  const j = await get('https://commons.wikimedia.org/w/api.php?' + qs({ action: 'query', format: 'json', formatversion: 2, prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: 330, iiextmetadatafilter: 'Artist|LicenseShortName', titles: part.join('|') }));
  const norm = new Map(((j && j.query && j.query.normalized) || []).map(r => [r.to, r.from]));
  for (const p of (j && j.query && j.query.pages) || []) {
    const ii = p.imageinfo && p.imageinfo[0]; if (!ii) continue;
    const m = ii.extmetadata || {}, lic = strip(m.LicenseShortName && m.LicenseShortName.value);
    if (!/^image\/(jpeg|png)$/.test(ii.mime) || !FREE.test(lic) || ii.width < 300) continue;
    const path = (ii.url || '').split('/wikipedia/commons/')[1]; if (!path) continue;
    CI.set(norm.get(p.title) || p.title, { path: path.split('?')[0], w: ii.width, a: strip(m.Artist && m.Artist.value).slice(0, 80) || 'auteur inconnu', l: lic, u: ii.descriptionurl });
  }
  await sleep(150);
}
const commonsThumb = (path, w) => { const f = path.split('/').pop(); return 'https://upload.wikimedia.org/wikipedia/commons/thumb/' + path + '/' + w + 'px-' + f; };
for (const s of SP) s.ph = s.cand.map(f => CI.get(f)).filter(Boolean).map(c => ({ src: 'c', path: c.path, s: c.w > 330 ? commonsThumb(c.path, 330) : 'https://upload.wikimedia.org/wikipedia/commons/' + c.path, w: c.w, b: c.w > 960 ? commonsThumb(c.path, 960) : 'https://upload.wikimedia.org/wikipedia/commons/' + c.path, a: c.a, l: c.l, u: c.u })).slice(0, 2);
say('Photos Wikimedia Commons : ' + SP.filter(s => s.ph.length).length + ' espèces');
// iNaturalist (observations de recherche sous CC0 ou CC BY), en France d'abord
const LIC = { 'http://creativecommons.org/publicdomain/zero/1.0/': 'CC0', 'http://creativecommons.org/licenses/by/4.0/': 'CC BY 4.0' };
await pool(SP.filter(s => s.g && s.ph.length < 2), 8, async s => {
  for (const country of ['FR', null]) {
    if (s.ph.length >= 2) break;
    const r = await gbif('occurrence/search?' + qs(Object.assign({ taxonKey: s.g, mediaType: 'StillImage', datasetKey: INAT, limit: 12 }, country ? { country } : {})) + '&license=CC0_1_0&license=CC_BY_4_0');
    for (const o of (r && r.results) || []) {
      if (s.ph.length >= 2) break;
      const md = (o.media || []).find(x => /inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/original\.(jpe?g|png)/i.test(x.identifier || '') && LIC[x.license]);
      if (!md || s.ph.some(p => p.obs === o.key)) continue;
      const [, pid, ext] = md.identifier.match(/photos\/(\d+)\/original\.(\w+)/);
      s.ph.push({ src: 'i', pid, ext, obs: o.key, s: 'https://inaturalist-open-data.s3.amazonaws.com/photos/' + pid + '/small.' + ext, b: 'https://inaturalist-open-data.s3.amazonaws.com/photos/' + pid + '/medium.' + ext,
        a: String(md.rightsHolder || md.creator || o.recordedBy || 'auteur inconnu').slice(0, 80), l: LIC[md.license], u: md.references || ('https://www.gbif.org/occurrence/' + o.key) });
    }
  }
});
say('Avec au moins une photo : ' + SP.filter(s => s.ph.length).length + ' / ' + SP.length);

// ---------------------------------------------------------------- 6. dangers connus
// genres qui comptent des espèces mortelles : jamais de cueillette sans identification experte
const RISK = new Set(['Amanita', 'Lepiota', 'Galerina', 'Cortinarius', 'Inocybe', 'Pseudosperma', 'Inosperma', 'Conocybe', 'Pholiotina', 'Gyromitra', 'Clitocybe', 'Entoloma', 'Hebeloma', 'Paxillus', 'Omphalotus', 'Tricholoma', 'Rubroboletus', 'Russula', 'Lactarius', 'Agaricus', 'Psilocybe', 'Panaeolus', 'Gymnopilus', 'Hypholoma', 'Ramaria', 'Helvella', 'Chlorophyllum', 'Leucoagaricus', 'Infundibulicybe', 'Paralepistopsis', 'Coprinopsis', 'Scleroderma', 'Mycena']);
const DEADLY_G = new Set(['Amanita', 'Lepiota', 'Galerina', 'Cortinarius', 'Conocybe', 'Pholiotina', 'Gyromitra', 'Inocybe', 'Pseudosperma', 'Inosperma', 'Clitocybe', 'Paxillus', 'Tricholoma']);
let nd = 0, nt = 0;
for (const s of SP) {
  const w = WD.get(s.id), p = w && w.wp && WP.get(w.wp);
  const labels = w ? [...w.ed].map(q => (EDL.get(q) || '').toLowerCase()) : [];
  const sum = summary(p && p.ex);
  s.ex = sum.text; s.wp = p && p.title; s.q = w && w.q;
  s.tox = '';
  if (labels.some(l => /deadly/.test(l))) s.tox = 'm';
  else if (labels.some(l => /poison|psychoactive/.test(l))) s.tox = 't';
  s.toxSrc = s.tox ? 'wd' : '';
  if (sum.flag && !s.tox) { s.tox = 't'; s.toxSrc = 'wp'; }
  s.toxTxt = sum.tox;
  s.risk = DEADLY_G.has(s.genus) ? 'g' : RISK.has(s.genus) ? 'r' : '';
  if (s.tox === 'm') nd++; else if (s.tox) nt++;
}
say('Signalées mortelles : ' + nd + ' ; signalées toxiques : ' + nt + ' ; dans un genre à espèces mortelles : ' + SP.filter(s => s.risk === 'g').length);

// ---------------------------------------------------------------- 7. fichiers
SP.sort((a, b) => b.n - a.n || a.fr[0].localeCompare(b.fr[0], 'fr'));
const mois = s => { const t = s.mo ? s.mo.reduce((a, b) => a + b, 0) : 0; if (t < 8) return ''; const mx = Math.max(...s.mo); return s.mo.map(v => Math.round(9 * v / mx)).join(''); };
const thumbKey = p => !p ? '' : p.src === 'c' ? (p.w > 330 ? 'c' : 'o') + p.path : 'i' + p.pid + '.' + p.ext;
rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT + '/d', { recursive: true });
const v = new Date().toISOString().slice(0, 10).replace(/-/g, '') + Math.random().toString(36).slice(2, 6);
// index : [id, nom, autres noms, nom latin, anciens noms, danger, mois, observations, photo, départements]
const rows = SP.map((s, i) => { s.chunk = Math.floor(i / CHUNK); return [s.id, s.fr[0], s.fr.slice(1).join('|'), s.lat, s.syn.slice(0, 8).join('|'), s.tox + s.risk, mois(s), s.n, thumbKey(s.ph[0]), s.dep]; });
writeFileSync(OUT + '/index.json', JSON.stringify({ v, gen: new Date().toISOString().slice(0, 10), n: rows.length, chunk: CHUNK, dep: DEP, sp: rows }));
for (let c = 0; c * CHUNK < SP.length; c++) {
  const part = {};
  for (const s of SP.slice(c * CHUNK, (c + 1) * CHUNK)) {
    part[s.id] = { a: s.auth, g: s.genus, f: s.fam, o: s.ord, k: s.cls, ex: s.ex, wp: s.wp || '', q: s.q || '', tx: s.toxTxt, nd: s.nd, gb: s.g || 0, syn: s.syn,
      ts: s.toxSrc, ph: s.ph.map(p => ({ s: p.s, b: p.b, a: p.a, l: p.l, u: p.u })) };
  }
  writeFileSync(OUT + '/d/' + c + '.json', JSON.stringify({ v, sp: part }));
}
say('Index : ' + rows.length + ' espèces, ' + Math.ceil(SP.length / CHUNK) + ' paquets de détails');
say('Les 40 plus observées : ' + SP.slice(0, 40).map(s => s.fr[0] + ' (' + s.n + ')').join(', '));
writeFileSync(OUT + '/rapport.txt', log.join('\n') + '\n');
