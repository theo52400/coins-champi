// Règles du jeu : espèces du Mycodex, points, niveaux, badges, défis de la semaine, zones explorées.

export const CATALOG = [
  { id: 'cepe', n: 'Cèpe', lat: 'Boletus edulis', cap: 'cepe', pts: 30, core: 'cepe' },
  { id: 'girolle', n: 'Girolle', lat: 'Cantharellus cibarius', cap: 'girolle', pts: 25, core: 'girolle' },
  { id: 'trompette', n: 'Trompette de la mort', lat: 'Craterellus cornucopioides', cap: 'trompette', pts: 20, core: 'trompette' },
  { id: 'hydne', n: 'Pied de mouton', lat: 'Hydnum repandum', cap: 'hydne', pts: 15, core: 'hydne' },
  { id: 'tube', n: 'Chanterelle en tube', lat: 'Craterellus tubaeformis', cap: 'tube', pts: 15, core: 'tube' },
  { id: 'bai', n: 'Bolet bai', lat: 'Imleria badia', cap: 'bai', pts: 15, core: 'bai' },
  { id: 'piedbleu', n: 'Pied bleu', lat: 'Lepista nuda', cap: 'piedbleu', pts: 15, core: 'piedbleu' },
  { id: 'coulemelle', n: 'Coulemelle', lat: 'Macrolepiota procera', cap: 'coulemelle', pts: 10, core: 'coulemelle' },
  { id: 'morille', n: 'Morille', lat: 'Morchella', cap: 'morille', pts: 40, core: 'morille' },
  { id: 'lactaire', n: 'Lactaire délicieux', lat: 'Lactarius deliciosus', cap: 'lactaire', pts: 10, core: 'lactaire' },
  { id: 'pleurote', n: 'Pleurote', lat: 'Pleurotus ostreatus', cap: 'pleurote', pts: 15, core: null,
    hab: 'Sur bois mort ou affaibli de feuillus (hêtre, peuplier), en touffes étagées, de l\'automne à l\'hiver.', conf: 'Vérifiez la sporée blanche à lilas et l\'absence d\'odeur désagréable ; certaines espèces lignicoles sont toxiques.', m: { 10: .6, 11: 1, 12: .9, 1: .7, 2: .4 } },
  { id: 'mousseron', n: 'Mousseron de la Saint-Georges', lat: 'Calocybe gambosa', cap: 'mousseron', pts: 30, core: null,
    hab: 'Prairies et lisières calcaires, haies, en cercles au printemps (avril-mai).', conf: 'Entolomes et inocybes toxiques, très proches au printemps : odeur de farine et lames serrées blanches.', m: { 4: 1, 5: .8, 3: .2 } },
  { id: 'rose', n: 'Rosé des prés', lat: 'Agaricus campestris', cap: 'rose', pts: 10, core: null,
    hab: 'Prés pâturés et pelouses, hors forêt, après les pluies d\'été et d\'automne.', conf: 'Amanites blanches mortelles : lames toujours blanches et volve à la base. Le rosé a des lames roses puis brunes.', m: { 7: .5, 8: .9, 9: 1, 10: .7 } },
  { id: 'russule', n: 'Russule charbonnière', lat: 'Russula cyanoxantha', cap: 'russule', pts: 10, core: null,
    hab: 'Hêtraies et chênaies, sols variés, de l\'été à l\'automne.', conf: 'Lames souples et grasses au toucher, saveur douce. Goûter une russule âcre ne remplace pas une identification.', m: { 7: .7, 8: 1, 9: 1, 10: .7 } },
  { id: 'sparassis', n: 'Sparassis crépu', lat: 'Sparassis crispa', cap: 'sparassis', pts: 25, core: null,
    hab: 'Au pied des pins, en grosse boule crépue rappelant un chou-fleur, fin d\'été et automne.', conf: 'Forme unique ; bien nettoyer, les aiguilles et la terre se logent partout.', m: { 8: .6, 9: 1, 10: .9, 11: .4 } },
  { id: 'cesar', n: 'Amanite des Césars', lat: 'Amanita caesarea', cap: 'cesar', pts: 50, core: null,
    hab: 'Chênaies et châtaigneraies chaudes, rare en Lorraine, après les étés chauds.', conf: 'Amanite tue-mouches (rouge à flocons blancs, lames blanches) : toxique. L\'oronge a des lames et un pied jaunes.', m: { 7: .6, 8: 1, 9: .9, 10: .3 } },
  { id: 'autre', n: 'Autre, à identifier', lat: '—', cap: 'inconnu', pts: 5, core: null,
    hab: 'Une trouvaille à faire identifier par un pharmacien ou une société mycologique.', conf: 'Ne consommez jamais un champignon sans identification certaine.', m: {} }
];
export const SPECIES_BY_ID = Object.fromEntries(CATALOG.map(s => [s.id, s]));
export const QTY = [null, { n: 'Quelques-uns', pts: 0 }, { n: 'Une poignée', pts: 5 }, { n: 'Un panier', pts: 15 }];
export const VISIBILITY = { prive: 'Privée', groupe: 'Groupe', flou: 'Groupe, position floutée' };

export const LEVELS = [
  [0, 'Spore'], [60, 'Mycélium'], [150, 'Primordium'], [300, 'Jeune pousse'], [500, 'Coureur des bois'],
  [800, 'Fin connaisseur'], [1200, 'Cueilleur émérite'], [1700, 'Mycologue'], [2400, 'Maître des sous-bois'], [3300, 'Grand mycologue']
];
export function levelOf(xp) {
  let i = 0; while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
  const cur = LEVELS[i][0], next = i + 1 < LEVELS.length ? LEVELS[i + 1][0] : null;
  return { level: i + 1, name: LEVELS[i][1], xp, cur, next, progress: next ? (xp - cur) / (next - cur) : 1 };
}

// Points d'une trouvaille (firstOfSpecies : première fois que le joueur trouve cette espèce)
export function findPoints(f, firstOfSpecies) {
  const sp = SPECIES_BY_ID[f.species] || SPECIES_BY_ID.autre;
  let p = sp.pts * (firstOfSpecies ? 2 : 1);
  if (f.hasPhoto) p += 5;
  p += (QTY[f.qty] || QTY[1]).pts;
  if (f.vis === 'groupe' || f.vis === 'flou') p += 3;
  return p;
}
export function sortiePoints(s) { const km = (s.dist || 0) / 1000; return km < 0.5 ? 0 : Math.min(40, Math.floor(km * 4)) + (km >= 1 ? 5 : 0); }
export const TREASURE_FOUND = 100, TREASURE_HIDDEN = 10, CHALLENGE_PTS = 50;

// Statistiques et XP recalculées à partir de l'historique du joueur (aucun compteur à désynchroniser)
export function computeProfile(finds, sorties, me) {
  const sorted = [...finds].sort((a, b) => a.ts - b.ts);
  const seen = new Set(), communes = new Set();
  let xp = 0, photos = 0, privees = 0, partagees = 0, paniers = 0, matinal = false;
  const perSpecies = {};
  for (const f of sorted) {
    const first = !seen.has(f.species);
    if (f.species && f.species !== 'autre') seen.add(f.species);
    xp += findPoints(f, first && f.species !== 'autre');
    perSpecies[f.species] = (perSpecies[f.species] || 0) + 1;
    if (f.hasPhoto) photos++;
    if (f.vis === 'prive') privees++; else partagees++;
    if (f.qty === 3) paniers++;
    if (f.commune) communes.add(f.commune);
    if (new Date(f.ts).getHours() < 8) matinal = true;
  }
  let km = 0;
  for (const s of sorties) { xp += sortiePoints(s); km += (s.dist || 0) / 1000; }
  const found = (me && me.treasuresFound) || [], hidden = (me && me.treasuresHidden) || [], claimed = (me && me.claimed) || [];
  xp += found.length * TREASURE_FOUND + hidden.length * TREASURE_HIDDEN + claimed.length * CHALLENGE_PTS;
  const stats = { finds: finds.length, species: [...seen], perSpecies, km, sorties: sorties.length, photos, privees, partagees, paniers, communes: communes.size, matinal, treasures: found.length, hidden: hidden.length, challenges: claimed.length };
  const badges = BADGES.filter(b => b.test(stats)).map(b => b.id);
  return Object.assign({ xp, badges, stats }, levelOf(xp));
}

export const BADGES = [
  { id: 'premiere', n: 'Première trouvaille', d: 'Enregistrer une trouvaille', icon: 'basket', test: s => s.finds >= 1 },
  { id: 'cepe', n: 'Premier cèpe', d: 'Trouver un cèpe', icon: 'cepe', test: s => s.species.includes('cepe') },
  { id: 'girolle', n: 'Œil d\'or', d: 'Trouver des girolles', icon: 'girolle', test: s => s.species.includes('girolle') },
  { id: 'morille', n: 'Chasseur de printemps', d: 'Trouver une morille', icon: 'morille', test: s => s.species.includes('morille') },
  { id: 'herbier5', n: 'Herbier naissant', d: 'Cinq espèces différentes', icon: 'book', test: s => s.species.length >= 5 },
  { id: 'herbier10', n: 'Herbier fourni', d: 'Dix espèces différentes', icon: 'book', test: s => s.species.length >= 10 },
  { id: 'matinal', n: 'Lève-tôt', d: 'Une trouvaille avant 8 h', icon: 'sun', test: s => s.matinal },
  { id: 'panier', n: 'Panier plein', d: 'Cinq paniers pleins', icon: 'basket', test: s => s.paniers >= 5 },
  { id: 'photo', n: 'Photographe', d: 'Vingt trouvailles en photo', icon: 'camera', test: s => s.photos >= 20 },
  { id: 'rando10', n: 'Marcheur', d: '10 km parcourus en sortie', icon: 'boot', test: s => s.km >= 10 },
  { id: 'rando50', n: 'Randonneur des sous-bois', d: '50 km parcourus en sortie', icon: 'boot', test: s => s.km >= 50 },
  { id: 'habitue', n: 'Habitué', d: 'Dix sorties', icon: 'flag', test: s => s.sorties >= 10 },
  { id: 'explorateur', n: 'Explorateur', d: 'Trouvailles dans 5 communes', icon: 'compass', test: s => s.communes >= 5 },
  { id: 'secret', n: 'Gardien des coins', d: 'Cinq trouvailles gardées secrètes', icon: 'lock', test: s => s.privees >= 5 },
  { id: 'genereux', n: 'Généreux', d: 'Dix trouvailles partagées', icon: 'share', test: s => s.partagees >= 10 },
  { id: 'tresor', n: 'Cèpe d\'or', d: 'Trouver un trésor caché', icon: 'star', test: s => s.treasures >= 1 },
  { id: 'farceur', n: 'Farceur', d: 'Cacher un cèpe d\'or', icon: 'star', test: s => s.hidden >= 1 },
  { id: 'equipe', n: 'Esprit d\'équipe', d: 'Réussir un défi de la semaine', icon: 'team', test: s => s.challenges >= 1 }
];

// ---------- défis de la semaine (pour tout le groupe) ----------
export function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - y0) / 864e5 + 1) / 7);
  return { key: t.getUTCFullYear() + '-S' + String(w).padStart(2, '0'), n: w };
}
export function weekStart(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const day = x.getDay() || 7; x.setDate(x.getDate() - day + 1);
  return x.getTime();
}
export const CHALLENGES = [
  { id: 'trois', n: 'Trois espèces', d: 'Trouvez trois espèces différentes', target: 3, unit: 'espèces', metric: (f) => new Set(f.filter(x => x.species !== 'autre').map(x => x.species)).size },
  { id: 'dixkm', n: 'Dix kilomètres', d: 'Marchez 10 km en sortie, tous ensemble', target: 10, unit: 'km', metric: (f, c) => Math.round(c.reduce((a, s) => a + (s.dist || 0), 0) / 100) / 10 },
  { id: 'levetot', n: 'Lève-tôt', d: 'Une trouvaille avant 9 h', target: 1, unit: 'trouvaille', metric: (f) => f.filter(x => new Date(x.ts).getHours() < 9).length },
  { id: 'reporters', n: 'Reporters', d: 'Cinq trouvailles en photo', target: 5, unit: 'photos', metric: (f) => f.filter(x => x.hasPhoto).length },
  { id: 'paniers', n: 'Paniers pleins', d: 'Trois paniers pleins', target: 3, unit: 'paniers', metric: (f) => f.filter(x => x.qty === 3).length },
  { id: 'tousdehors', n: 'Tous dehors', d: 'Trois membres différents font une sortie', target: 3, unit: 'membres', metric: (f, c) => new Set(c.map(s => s.uid)).size },
  { id: 'communes', n: 'Nouveaux horizons', d: 'Des trouvailles dans trois communes', target: 3, unit: 'communes', metric: (f) => new Set(f.map(x => x.commune).filter(Boolean)).size }
];
export function weekChallenges(date, groupFinds, carnets) {
  const wk = isoWeek(date), start = weekStart(date);
  const f = groupFinds.filter(x => x.ts >= start), c = carnets.filter(x => (x.end || x.start || 0) >= start);
  const a = CHALLENGES[wk.n % CHALLENGES.length], b = CHALLENGES[(wk.n * 3 + 2) % CHALLENGES.length];
  const list = a.id === b.id ? [a, CHALLENGES[(wk.n + 1) % CHALLENGES.length]] : [a, b];
  return list.map(ch => { const v = ch.metric(f, c); return { id: ch.id, key: wk.key + ':' + ch.id, n: ch.n, d: ch.d, target: ch.target, unit: ch.unit, value: v, done: v >= ch.target }; });
}

// ---------- zones explorées (cases d'environ 50 m le long des traces) ----------
const R = 6378137;
export const FOG = { dlat: 50 / 110540, dlng: 50 / (111320 * Math.cos(49 * Math.PI / 180)) };
export function exploredCells(points, set) {
  const out = set || new Set();
  for (const p of points) {
    const a = Math.floor(p[0] / FOG.dlat), b = Math.floor(p[1] / FOG.dlng);
    for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) out.add((a + da) + ':' + (b + db));
  }
  return out;
}
export function cellBounds(key) { const [a, b] = key.split(':').map(Number); return [a * FOG.dlat, b * FOG.dlng, (a + 1) * FOG.dlat, (b + 1) * FOG.dlng]; }

// ---------- traces : encodage compact (polyline Google, précision 1e-5) ----------
export function encodeTrack(pts) {
  let out = '', plat = 0, plng = 0;
  const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  for (const [la, lo] of pts) { const a = Math.round(la * 1e5), b = Math.round(lo * 1e5); out += enc(a - plat) + enc(b - plng); plat = a; plng = b; }
  return out;
}
export function decodeTrack(str) {
  const pts = []; let i = 0, lat = 0, lng = 0;
  const dec = () => { let r = 0, s = 0, b; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20); return (r & 1) ? ~(r >> 1) : r >> 1; };
  while (i < (str || '').length) { lat += dec(); lng += dec(); pts.push([lat / 1e5, lng / 1e5]); }
  return pts;
}
export function haversine(a, b) {
  const t = Math.PI / 180, dla = (b[0] - a[0]) * t, dlo = (b[1] - a[1]) * t;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dlo / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function bearing(a, b) {
  const t = Math.PI / 180, y = Math.sin((b[1] - a[1]) * t) * Math.cos(b[0] * t);
  const x = Math.cos(a[0] * t) * Math.sin(b[0] * t) - Math.sin(a[0] * t) * Math.cos(b[0] * t) * Math.cos((b[1] - a[1]) * t);
  return (Math.atan2(y, x) / t + 360) % 360;
}
// Simplification Douglas-Peucker (mètres) pour garder des traces légères
export function simplifyTrack(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const proj = p => { const k = Math.cos(pts[0][0] * Math.PI / 180); return [p[1] * 111320 * k, p[0] * 110540]; };
  const P = pts.map(proj);
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop(); let dmax = 0, idx = -1;
    const [ax, ay] = P[a], [bx, by] = P[b], dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * P[i][0] - dx * P[i][1] + bx * ay - by * ax) / L; if (d > dmax) { dmax = d; idx = i; } }
    if (dmax > tol && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// Floutage d'une position (décalage aléatoire jusqu'à r mètres)
export function blur(lat, lng, r) {
  const d = r * (0.5 + Math.random() * 0.5), a = Math.random() * 2 * Math.PI;
  return [lat + d * Math.cos(a) / 110540, lng + d * Math.sin(a) / (111320 * Math.cos(lat * Math.PI / 180))];
}
export function newId(prefix) {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = ''; const r = crypto.getRandomValues(new Uint8Array(10)); for (const v of r) s += a[v % a.length];
  return (prefix || '') + Date.now().toString(36) + s;
}
export function groupCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; const r = crypto.getRandomValues(new Uint8Array(8)); for (const v of r) s += a[v % a.length];
  return s;
}
