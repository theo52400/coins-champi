// Service worker de Coins à champi : appli disponible sans réseau, fond de carte et peuplements gardés en cache.
const VERSION = 'v2026-10-28-42ac91fc';
const SHELL = 'cc-shell-' + VERSION;
const TILES = 'cc-tiles';
const DATA = 'cc-data';
const GEOL = 'cc-geol';
const MAX_TILES = 6000;
// Dans l'appli Android (sw.js?native=1), les fichiers de l'appli sont dans le téléphone : on ne garde en cache
// que ce qui vient d'Internet (fonds de carte, peuplements, météo)
const NATIVE = new URL(self.location.href).searchParams.get('native') === '1';
const ASSETS = [
  './', 'index.html', 'manifest.webmanifest', 'config.js',
  'css/app.css',
  'js/app.js', 'js/core.js', 'js/game.js', 'js/map.js', 'js/sync.js', 'js/localstore.js', 'js/photos.js', 'js/avatar3d.js',
  'vendor/leaflet.js', 'vendor/leaflet.css', 'vendor/three.module.min.js', 'vendor/firebase.js',
  'fonts/alegreya-latin-700-normal.woff2', 'fonts/alegreya-latin-500-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'icons/favicon-48.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'
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
    try { const g = await caches.open(GEOL); const r = await fetch(new Request('data/geol/index.json', { cache: 'reload' })); if (r.ok) await g.put('data/geol/index.json', r); } catch (e) { /* facultatif */ }
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
const isData = u => (u.hostname === 'data.geopf.fr' && (u.pathname.startsWith('/wfs') || u.pathname.startsWith('/altimetrie')) && !/getcapabilities/i.test(u.search)) || u.hostname === 'services.esrifrance.fr' || u.hostname === 'api.open-meteo.com';

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) { if (NATIVE) return; event.respondWith(/\/data\/geol\//.test(u.pathname) ? geol(req) : shell(req, u)); return; }
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

// Sous-sol : l'index d'abord au réseau (il donne la version des données), les tuiles en cache d'abord
// (le numéro de version est dans leur adresse) ; tout reste disponible hors réseau
async function geol(req) {
  const cache = await caches.open(GEOL);
  if (/index\.json$/.test(new URL(req.url).pathname)) {
    const net = fetch(req).then(async res => {
      if (res.ok) {
        await cache.put(req, res.clone()).catch(() => {});
        // nouvelles données : on retire les tuiles des versions précédentes
        try { const v = String((await res.clone().json()).v); for (const k of await cache.keys()) { const kv = new URL(k.url).searchParams.get('v'); if (kv && kv !== v) cache.delete(k); } } catch (e) { /* ignore */ }
      }
      return res;
    });
    net.catch(() => {});
    const cached = await cache.match(req);
    if (!cached) return net;
    try { const r = await Promise.race([net, new Promise(ok => setTimeout(() => ok(null), 4000))]); return r && r.ok ? r : cached; } catch (e) { return cached; }
  }
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
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
