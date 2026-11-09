// Service worker de Coins à champi : appli disponible sans réseau, fond de carte et peuplements gardés en cache.
const VERSION = 'v2026-11-09-d805bea6';
const SHELL = 'cc-shell-' + VERSION;
const TILES = 'cc-tiles';
const DATA = 'cc-data';
const GEOL = 'cc-geol';
const FORET = 'cc-foret';
const ENCY = 'cc-encyclo';
const CATA = 'cc-catalogue';
const CATIMG = 'cc-catalogue-img';
const MAX_CATIMG = 800;
const MAX_TILES = 6000;
// Dans l'appli Android (sw.js?native=1), les fichiers de l'appli sont dans le téléphone : on ne garde en cache
// que ce qui vient d'Internet (fonds de carte, peuplements, météo)
const NATIVE = new URL(self.location.href).searchParams.get('native') === '1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'config.js',
  'css/app.css',
  'js/app.js', 'js/core.js', 'js/game.js', 'js/map.js', 'js/far.js', 'js/learn.js', 'js/encyclo.js', 'js/catalogue.js', 'js/sync.js', 'js/localstore.js', 'js/photos.js', 'js/avatar3d.js',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/three.module.min.js', 'vendor/firebase.js',
  'fonts/alegreya-latin-700-normal.woff2', 'fonts/alegreya-latin-500-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'icons/favicon-48.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  // icônes des espèces : début
  'icons/especes/agaric_auguste.webp', 'icons/especes/agaric_jacheres.webp', 'icons/especes/amadouvier.webp', 'icons/especes/amanite_blanche.webp',
  'icons/especes/amanite_citrine.webp', 'icons/especes/amanite_epaisse.webp', 'icons/especes/amanite_jonquille.webp', 'icons/especes/amanite_vaginee.webp',
  'icons/especes/amer.webp', 'icons/especes/anthurus.webp', 'icons/especes/armillaire.webp', 'icons/especes/bai.webp',
  'icons/especes/bolet_appendicule.webp', 'icons/especes/bolet_beau_pied.webp', 'icons/especes/bolet_bouviers.webp', 'icons/especes/bolet_elegant.webp',
  'icons/especes/bolet_jaune.webp', 'icons/especes/bolet_legal.webp', 'icons/especes/bolet_pourpre.webp', 'icons/especes/bolet_radicant.webp',
  'icons/especes/bolet_rude.webp', 'icons/especes/cepe.webp', 'icons/especes/cesar.webp', 'icons/especes/chanterelle_jaunissante.webp',
  'icons/especes/clathre_rouge.webp', 'icons/especes/clavaire_elegante.webp', 'icons/especes/clitoblanc.webp', 'icons/especes/clitocybe_nebuleux.webp',
  'icons/especes/collybie_velue.webp', 'icons/especes/coprin.webp', 'icons/especes/coprin_noir.webp', 'icons/especes/cortinaire.webp',
  'icons/especes/coulemelle.webp', 'icons/especes/craterelle_sinueuse.webp', 'icons/especes/emetique.webp', 'icons/especes/entolome.webp',
  'icons/especes/equestre.webp', 'icons/especes/faussegirolle.webp', 'icons/especes/galere.webp', 'icons/especes/ganoderme.webp',
  'icons/especes/girolle.webp', 'icons/especes/gymnopile.webp', 'icons/especes/gyromitre.webp', 'icons/especes/hebelome.webp',
  'icons/especes/helvelle_crepue.webp', 'icons/especes/hydne.webp', 'icons/especes/hydne_herisson.webp', 'icons/especes/hydne_imbrique.webp',
  'icons/especes/hydne_roux.webp', 'icons/especes/hygrophore.webp', 'icons/especes/hygrophore_pres.webp', 'icons/especes/hypholome.webp',
  'icons/especes/inconnu.webp', 'icons/especes/inocybe.webp', 'icons/especes/inocybe_fastigie.webp', 'icons/especes/jaunissant.webp',
  'icons/especes/laccaire.webp', 'icons/especes/lactaire.webp', 'icons/especes/lactaire_plombe.webp', 'icons/especes/lactaire_poivre.webp',
  'icons/especes/lactaire_sanguin.webp', 'icons/especes/lactaire_saumon.webp', 'icons/especes/langue_boeuf.webp', 'icons/especes/leccinum.webp',
  'icons/especes/lepiote.webp', 'icons/especes/lepiote_cretee.webp', 'icons/especes/lepiote_deguenillee.webp', 'icons/especes/marasme.webp',
  'icons/especes/meunier.webp', 'icons/especes/morille.webp', 'icons/especes/morillon.webp', 'icons/especes/mousseron.webp',
  'icons/especes/mycene_pure.webp', 'icons/especes/olivier.webp', 'icons/especes/oreille_judas.webp', 'icons/especes/panthere.webp',
  'icons/especes/paxille.webp', 'icons/especes/pezize_orangee.webp', 'icons/especes/phalloide.webp', 'icons/especes/pholiote_ecailleuse.webp',
  'icons/especes/pholiote_peuplier.webp', 'icons/especes/pholiote_ridee.webp', 'icons/especes/pholiotine.webp', 'icons/especes/pied_rouge.webp',
  'icons/especes/pied_violet.webp', 'icons/especes/piedbleu.webp', 'icons/especes/pleurote.webp', 'icons/especes/pleurote_corne.webp',
  'icons/especes/pleurote_panicaut.webp', 'icons/especes/polypore_bouleau.webp', 'icons/especes/polypore_ombelle.webp', 'icons/especes/polypore_soufre.webp',
  'icons/especes/poule_bois.webp', 'icons/especes/rose.webp', 'icons/especes/russule.webp', 'icons/especes/russule_fetide.webp',
  'icons/especes/russule_verte.webp', 'icons/especes/russule_vesca.webp', 'icons/especes/satan.webp', 'icons/especes/satyre.webp',
  'icons/especes/scleroderme.webp', 'icons/especes/sparassis.webp', 'icons/especes/tete_moine.webp', 'icons/especes/toison.webp',
  'icons/especes/tremelle.webp', 'icons/especes/tricholome_pretentieux.webp', 'icons/especes/tricholome_savonneux.webp', 'icons/especes/tricholome_soufre.webp',
  'icons/especes/tricholome_tigre.webp', 'icons/especes/trompette.webp', 'icons/especes/truffe.webp', 'icons/especes/truffe_noire.webp',
  'icons/especes/tube.webp', 'icons/especes/tuemouche.webp', 'icons/especes/vachotte.webp', 'icons/especes/verpe_boheme.webp',
  'icons/especes/vesse.webp', 'icons/especes/vesse_perlee.webp', 'icons/especes/xylaire.webp',
  // icônes des espèces : fin
];

self.addEventListener('install', event => {
  if (NATIVE) { self.skipWaiting(); return; }
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // cache: 'reload' : on prend les fichiers sur le serveur, pas dans le cache HTTP du navigateur
    await Promise.all(ASSETS.map(async a => {
      const res = await fetch(new Request(a, { cache: 'reload' }));
      if (!res.ok) throw new Error(a + ' : HTTP ' + res.status);
      await cache.put(a, res);
    }));
    // index du sous-sol : disponible hors réseau dès la première visite (les tuiles suivent au fil de la carte)
    for (const [c, f] of [[GEOL, 'data/geol/index.json'], [FORET, 'data/foret/index.json']]) {
      try { const g = await caches.open(c); const r = await fetch(new Request(f, { cache: 'reload' })); if (r.ok) await g.put(f, r); } catch (e) { /* facultatif */ }
    }
    // Pas de skipWaiting ici : l'appli propose « Mettre à jour » pour ne pas changer de version en pleine sortie
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('cc-shell-') && k !== SHELL) || k === 'cc-sol') await caches.delete(k);
    await self.clients.claim();
  })());
});

const isTile = u => (u.hostname === 'data.geopf.fr' && u.pathname.startsWith('/wmts')) || /(^|\.)tile\.openstreetmap\.org$/.test(u.hostname) || u.hostname === 'geoservices.brgm.fr' || (u.hostname === 'data.geopf.fr' && /^\/wms/.test(u.pathname));
const isData = u => (u.hostname === 'data.geopf.fr' && (u.pathname.startsWith('/wfs') || u.pathname.startsWith('/altimetrie')) && !/getcapabilities/i.test(u.search)) || u.hostname === 'services.esrifrance.fr' || u.hostname === 'api.open-meteo.com' ||
  (u.hostname === 'theo52400.github.io' && /\/data\/meteo\//.test(u.pathname));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (NATIVE) return;
    if (/\/data\/geol\//.test(u.pathname)) event.respondWith(dataset(req, GEOL));
    else if (/\/data\/foret\//.test(u.pathname)) event.respondWith(dataset(req, FORET));
    else if (/\/data\/meteo\//.test(u.pathname)) event.respondWith(data(req));
    else if (/\/data\/encyclo\//.test(u.pathname)) event.respondWith(dataset(req, ENCY));
    else if (/\/data\/catalogue\//.test(u.pathname)) event.respondWith(dataset(req, CATA));
    else event.respondWith(shell(req, u));
    return;
  }
  // appli Android : photos de l'encyclopédie prises sur le site publié, gardées pour le hors-ligne
  if (u.hostname === 'theo52400.github.io' && /\/data\/encyclo\//.test(u.pathname)) { event.respondWith(dataset(req, ENCY)); return; }
  if (u.hostname === 'theo52400.github.io' && /\/data\/catalogue\//.test(u.pathname)) { event.respondWith(dataset(req, CATA)); return; }
  // photos libres du catalogue (Wikimedia Commons, iNaturalist) : gardées pour le hors-ligne une fois vues
  if (u.hostname === 'upload.wikimedia.org' || u.hostname === 'inaturalist-open-data.s3.amazonaws.com') { event.respondWith(catImg(req)); return; }
  if (isTile(u)) { event.respondWith(tile(req)); return; }
  if (isData(u)) { event.respondWith(data(req)); return; }
  // Firebase, Google et le reste : directement au réseau
});

// Fichiers de l'appli : cache d'abord (version cohérente), réseau sinon
async function shell(req, u) {
  const cache = await caches.open(SHELL);
  if (req.mode === 'navigate') {
    const hit = await cache.match('index.html');
    if (hit) return hit;
    return fetch(req);
  }
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  return fetch(req);
}

// Sous-sol et forêts de France : l'index d'abord au réseau (il donne la version des données), les tuiles en cache d'abord
// (le numéro de version est dans leur adresse) ; tout reste disponible hors réseau
async function dataset(req, name) {
  const cache = await caches.open(name), key = req.url;
  // fichier d'un autre site (appli Android : le site publié) : demandé en CORS pour pouvoir le garder en cache
  const ask = () => (new URL(key).origin !== self.location.origin ? fetch(new Request(key, { mode: 'cors', credentials: 'omit' })) : fetch(req));
  if (/(index|photos)\.json$/.test(new URL(key).pathname)) {
    const net = ask().then(async res => {
      if (res.ok) {
        await cache.put(key, res.clone()).catch(() => {});
        // nouvelles données : on retire les fichiers des versions précédentes (adressés par ?v=)
        try { const v = String((await res.clone().json()).v); for (const k of await cache.keys()) { const kv = new URL(k.url).searchParams.get('v'); if (kv && kv !== v) cache.delete(k); } } catch (e) { /* ignore */ }
      }
      return res;
    });
    net.catch(() => {});
    const cached = await cache.match(key);
    if (!cached) return net;
    try { const r = await Promise.race([net, new Promise(ok => setTimeout(() => ok(null), 4000))]); return r && r.ok ? r : cached; } catch (e) { return cached; }
  }
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await ask();
  if (res.ok) cache.put(key, res.clone()).catch(() => {});
  return res;
}

// Photos du catalogue : cache d'abord ; demandées en CORS pour ne garder que des réponses lisibles (pas de réponses opaques)
let catPuts = 0;
async function catImg(req) {
  const cache = await caches.open(CATIMG);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' }));
    if (res.ok) cache.put(req.url, res.clone()).then(() => { if (++catPuts % 50 === 0) trim(cache, MAX_CATIMG); }).catch(() => {});
    return res;
  } catch (e) { return fetch(req); }
}

// Tuiles : cache d'abord. On demande la tuile en CORS pour que le cache ne soit pas gonflé par des réponses opaques.
let puts = 0;
async function tile(req) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  let res;
  try { res = await fetch(new Request(req.url, { mode: 'cors', credentials: 'omit' })); }
  catch (e) { res = await fetch(req); }
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    cache.put(req.url, copy).then(() => { if (++puts % 200 === 0) trim(cache, MAX_TILES); }).catch(() => trim(cache, Math.floor(MAX_TILES / 2)));
  }
  return res;
}
async function trim(cache, max) {
  try { const keys = await cache.keys(); for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); } catch (e) { /* ignore */ }
}

// Données (forêts, météo, altitude) : réseau d'abord ; si le réseau traîne ou manque, la dernière copie gardée
async function data(req) {
  const cache = await caches.open(DATA);
  const net = fetch(req).then(res => { if (res.ok) cache.put(req.url, res.clone()).catch(() => {}); return res; });
  net.catch(() => {});
  const cached = await cache.match(req.url);
  if (!cached) return net;
  const timeout = new Promise(r => setTimeout(() => r(null), 6000));
  try {
    const first = await Promise.race([net, timeout]);
    return first || cached;
  } catch (e) { return cached; }
}

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
