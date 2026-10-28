// Coins à champi — appli de groupe : carte des coins, profils et avatars 3D, sorties en direct,
// trouvailles en photo, Mycodex, badges, défis et cèpes d'or.
import { Core as C } from './core.js';
import * as Game from './game.js';
import { connect } from './sync.js';
import { createMap, POT_COL, SOIL_COLORS } from './map.js';
import { createLearn } from './learn.js';
import { pickImage, processPhoto } from './photos.js';
import { FIREBASE_CONFIG } from '../config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ?as=nom : plusieurs joueurs de test dans le même navigateur (mode solo), chacun avec ses réglages
const NS = (new URLSearchParams(location.search).get('as') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
// Typographie française : espace insécable avant ? ! : ; » et après «, pour éviter les retours à la ligne orphelins
const FR_RE = / ([?!:;»])|(«) /g;
function frText(node) {
  const fix = n => { const v = n.nodeValue, r = v.replace(FR_RE, (m, a, b) => a ? '\u00a0' + a : b + '\u00a0'); if (r !== v) n.nodeValue = r; };
  if (node.nodeType === 3) { if (!node.parentNode || !/^(SCRIPT|STYLE|TEXTAREA)$/.test(node.parentNode.nodeName)) fix(node); return; }
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = w.nextNode(); n; n = w.nextNode()) fix(n);
}
new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') frText(m.target); else m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) frText(n); }); } }).observe(document.body, { childList: true, subtree: true, characterData: true });
frText(document.body);
const store = {
  get(k, d) { try { const v = localStorage.getItem(NS ? k + '@' + NS : k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { const key = NS ? k + '@' + NS : k; if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
};
const NOW = new Date(), MONTH = NOW.getMonth() + 1;
const TODAY = NOW.getFullYear() + '-' + String(MONTH).padStart(2, '0') + '-' + String(NOW.getDate()).padStart(2, '0');
const APP_START = Date.now();
// Grands massifs forestiers connus des cueilleurs, du nord au sud
const MASSIFS = [
  ['Ardennes (Revin)', 49.93, 4.64], ['Forêt de Compiègne', 49.37, 2.90], ['Vosges du Nord (Bitche)', 49.05, 7.43], ['Warndt (Moselle)', 49.185, 6.72],
  ['Brocéliande (Paimpont)', 48.02, -2.17], ['Forêt de Rambouillet', 48.63, 1.80], ['Forêt de Fontainebleau', 48.40, 2.65], ['Vosges (Gérardmer)', 48.07, 6.88],
  ['Forêt d\'Orléans', 47.98, 2.20], ['Sologne', 47.60, 2.02], ['Morvan (Settons)', 47.19, 4.06], ['Forêt de Chaux (Jura)', 47.10, 5.65],
  ['Forêt de la Joux (Jura)', 46.86, 6.07], ['Forêt de Tronçais', 46.63, 2.73], ['Plateau de Millevaches', 45.65, 2.10], ['Chartreuse', 45.34, 5.81],
  ['Forêt des Landes', 44.15, -0.74], ['Cévennes (Aigoual)', 44.12, 3.58], ['Forêt d\'Iraty (Pyrénées)', 43.03, -1.05], ['Vizzavona (Corse)', 42.12, 9.13]
];
const ICON = {
  lock: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  car: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 16l1.5-6h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1.5"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/></svg>',
  eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  flag: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  sos: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
  medal: { basket: 'M4 10h16l-2 9H6zM8 10l4-6 4 6', cepe: 'M4 12a8 6 0 0 1 16 0zM9 12v6a3 3 0 0 0 6 0v-6', girolle: 'M4 6c4 1 12 1 16 0l-6 8v6h-4v-6z', morille: 'M12 3c3 2 4 6 3 11H9C8 9 9 5 12 3zM10 14v6h4v-6', book: 'M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0zM12 5c2.5-1.5 5-1.5 8 0v15c-3-1.5-5.5-1.5-8 0', sun: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12 2v2M12 20v2M2 12h2M20 12h2', camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6', boot: 'M6 3h5v9l7 3v5H6z', flag: 'M5 21V4h11l-2 4 2 4H5', compass: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM15 9l-2 5-4 1 2-5z', lock: 'M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3', share: 'M6 12a2 2 0 1 1 0 .1M18 6a2 2 0 1 1 0 .1M18 18a2 2 0 1 1 0 .1M8 11l8-4M8 13l8 4', star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z', team: 'M9 8a3 3 0 1 1 0 .1M3 20c.6-3.6 3-5.5 6-5.5s5.4 1.9 6 5.5M17 9a2.5 2.5 0 1 1 0 .1M16 14.6c2.8.1 4.9 1.9 5.5 4.9' , eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6', shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4' }
};
const medalSvg = k => '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><path d="' + (ICON.medal[k] || ICON.medal.star) + '"/></svg>';
const fmtKm = m => m < 1000 ? Math.round(m) + ' m' : (Math.round(m / 100) / 10).toLocaleString('fr-FR') + ' km';
const fmtHa = h => h >= 100 ? Math.round(h).toLocaleString('fr-FR') + ' ha' : h >= 10 ? Math.round(h) + ' ha' : (Math.round(h * 10) / 10).toLocaleString('fr-FR') + ' ha';
const fmtDur = ms => { const m = Math.floor(ms / 60000); return m < 1 ? '< 1 min' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };
const ago = ts => { const s = Math.max(0, (Date.now() - ts) / 1000); return s < 60 ? 'à l\'instant' : s < 3600 ? 'il y a ' + Math.round(s / 60) + ' min' : s < 86400 ? 'il y a ' + Math.round(s / 3600) + ' h' : new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
const dateFr = ts => new Date(ts).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' à ' + new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const logs = [];
function log(msg) { logs.push(new Date().toLocaleTimeString('fr-FR') + ' ' + msg); if (logs.length > 60) logs.shift(); const el = $('#diag'); if (el) el.textContent = logs.join('\n'); }
let toastT = null;
function toast(msg, ms, cls) { const el = $('#toast'); el.textContent = msg; el.className = 'toast' + (cls ? ' ' + cls : ''); el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3500); }
const vibrate = p => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (e) { /* ignore */ } };
// Appli Android : le pont Capacitor est présent ; son module (suivi écran éteint, notifications, partage) est
// chargé à la demande. Le site et l'appli partagent les mêmes groupes, en direct.
const IN_APP = !!window.androidBridge;
const SITE_URL = 'https://theo52400.github.io/coins-champi/';
const APK_URL = 'https://github.com/theo52400/coins-champi/releases/latest/download/coins-a-champi.apk';
const ANDROID_WEB = !IN_APP && /Android/i.test(navigator.userAgent);
let NativeApp = null;
const nativeReady = IN_APP ? import('./native.js').then(m => (NativeApp = m.isNative() ? m : null)).catch(e => { log('Appli Android : ' + e.message); return null; }) : Promise.resolve(null);

// ---------------------------------------------------------------- état
const S = {
  sync: null, uid: null, me: null, meLoaded: false, myFinds: [], mySorties: [], loadedFinds: false, loadedSorties: false,
  gid: store.get('cc.gid', null), group: null, members: [], presence: [], groupFinds: [], carnets: [], events: [], treasures: [],
  sp: store.get('cc.sp', 'all'), mode: 'pot', showLow: store.get('cc.low', false), farWx: store.get('cc.farwx', true), base: store.get('cc.base', 'plan'),
  wx: null, wxErr: null, wxAt: null, point: null, prof: null, badgesSeen: null,
  settings: Object.assign({ share: true, vis: 'groupe', wake: true, liveShare: false }, store.get('cc.settings', {})),
  sortie: store.get('cc.sortie', null), unsubGroup: [], stages: new Set(), sheet: 'peek', tab: 'carte'
};
if (S.sp !== 'all' && !C.SPECIES.some(s => s.id === S.sp)) S.sp = 'all';
let Av = null;
const avP = import('./avatar3d.js').then(m => { Av = m; onAvatarsReady(); return m; }).catch(e => { log('Avatars 3D indisponibles : ' + e.message); return null; });
const avatarImg = (cfg, size) => Av ? Av.snapshot(cfg || {}, { size: size || 128 }) : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const speciesImg = (id, size) => { const sp = Game.SPECIES_BY_ID[id] || Game.SPECIES_BY_ID.autre; return Av ? Av.speciesIcon(sp.cap, size || 96) : 'data:image/gif;base64,R0lGODlhAQABAAAAACw='; };
const spColor = id => { const sp = Game.SPECIES_BY_ID[id]; return Av && sp && Av.CAPS[sp.cap] ? Av.CAPS[sp.cap].tints[0] : '#4A2C8F'; };

// ---------------------------------------------------------------- carte
let M = null;
// Données publiées avec le site ; dans l'appli Android, la météo du jour (elle change chaque matin) et les photos
// de l'encyclopédie (lourdes) viennent du site publié
const dataUrl = p => (IN_APP && /^data\/(meteo|encyclo)\//.test(p) ? SITE_URL + p : p);
// Onglet « Apprendre » : encyclopédie, quiz, Mycodex
const learn = createLearn({
  $, esc, store, S, MONTH, dataUrl,
  mycodexHtml: () => mycodexHtml(),
  rerender: () => renderPanelIfOpen('mycodex'),
  onPoints: (pts, line) => celebrate(pts, line),
  openSpeciesMap: id => { openTab('carte'); selectSp(id); },
  saveQuiz: q => { if (S.sync) S.sync.saveMe({ quiz: q }).catch(() => {}); onProfileData(); }
});
async function boot() {
  M = createMap($('#map'), { log, toast, store, onTap, dataUrl, onChange: () => { updatePeek(); refreshMore(); }, onBlocked: () => { $('#blocked').hidden = false; }, onLayerFail: k => { const el = $('#lyr-' + k); if (el) el.checked = false; } });
  M.setBase(S.base); M.setShowLow(S.showLow); M.setSpecies(S.sp); M.setMode('pot'); M.far.setWx(S.farWx);
  M.map.on('moveend', () => loadWeather());
  M.map.on('dragstart', () => { GPS.centerNext = false; if (GPS.follow) setFollow(false); });
  autoLocate();
  buildRail(); wireUi(); setSheet('peek'); updatePeek(); refreshMore(); loadWeather(true);
  registerSW();
  window.addEventListener('online', () => startSync());
  await startSync();
  if (S.sortie) resumeSortie();
  if (IN_APP) checkAppUpdate();
}
// Appli Android : une nouvelle version est-elle publiée ? (au plus une fois toutes les 6 heures)
async function checkAppUpdate() {
  const n = await nativeReady;
  if (!n || Date.now() - store.get('cc.appCheck', 0) < 6 * 3600e3) return;
  store.set('cc.appCheck', Date.now());
  const v = await n.newerApp();
  if (v) showBanner('Une nouvelle version de l\'appli est disponible (n° ' + v.n + ').', 'Installer', () => { $('#banner').hidden = true; location.href = APK_URL; });
}
// Connexion au jeu ; sans réseau (premier lancement), on réessaie dès que le réseau revient
let syncing = false, syncRetry = null;
async function startSync() {
  if (S.sync || syncing) return;
  syncing = true;
  try {
    const sync = await connect(FIREBASE_CONFIG);
    S.sync = sync; S.uid = sync.uid;
    sync.onError = (what, e) => {
      log('Synchro ' + what + ' : ' + (e.code || '') + ' ' + e.message);
      if (/does not exist|not-found.*database|database.*not.*exist/i.test((e.code || '') + ' ' + (e.message || ''))) { toast('La base de données Firestore n\'existe pas encore : Firebase → Firestore Database → Créer une base de données.', 9000); return; }
      if (!/permission/i.test(e.code || e.message)) return;
      if (S.gid && GROUP_WATCHES.includes(what)) { if (!lostGroup) { lostGroup = true; toast('Vous ne faites plus partie de ce groupe.', 5000); watchGroup(null); setTimeout(() => { lostGroup = false; }, 3000); } return; }
      toast('Accès refusé (' + what + '). Vérifiez les règles Firestore.', 6000);
    };
    log('Connecté (' + sync.kind + '), joueur ' + S.uid.slice(0, 8));
    if ($('#banner').dataset.kind === 'offline') $('#banner').hidden = true;
    if (sync.kind === 'local' && !store.get('cc.soloSeen', false)) showBanner('Mode solo : vos données restent sur ce téléphone.', 'Pourquoi ?', () => openInfoSolo(), () => store.set('cc.soloSeen', true));
    startUserWatchers();
  } catch (e) {
    log('Connexion : ' + (e.code || '') + ' ' + e.message);
    const why = connProblem(e);
    showBanner(why ? 'Le jeu ne peut pas se connecter : ' + why : 'Pas de connexion au serveur du jeu. La carte fonctionne ; le jeu reprend dès que le réseau revient.', 'Réessayer', () => startSync());
    $('#banner').dataset.kind = 'offline';
    clearTimeout(syncRetry); syncRetry = setTimeout(startSync, 60000);
  } finally { syncing = false; }
}
// Causes connues d'un échec de connexion Firebase, expliquées avec l'endroit où corriger (null : simple problème de réseau)
function connProblem(e) {
  const c = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
  if (/admin-restricted-operation|operation-not-allowed|ADMIN_ONLY_OPERATION|OPERATION_NOT_ALLOWED/.test(c)) return 'la connexion « Anonyme » n\'est pas activée dans Firebase (Authentication → Méthode de connexion → Anonyme → Activer → Enregistrer).';
  if (/configuration-not-found|CONFIGURATION_NOT_FOUND/.test(c)) return 'Authentication n\'est pas encore activé dans Firebase (Authentication → Commencer, puis activer « Anonyme »).';
  if (/unauthorized-domain/.test(c)) return 'cette adresse n\'est pas autorisée par Firebase (Authentication → Paramètres → Domaines autorisés → ajouter ' + location.hostname + ').';
  if (/requests-from-referer/.test(c)) return 'la clé API de Firebase est réservée à d\'autres sites (Google Cloud → API et services → Identifiants → clé du navigateur → ajouter ' + location.hostname + ').';
  if (/api-key|API_KEY|project-not-found|app-not-authorized/i.test(c)) return 'la configuration Firebase de l\'appli est refusée (' + ((e && e.code) || 'clé API') + ').';
  if (navigator.onLine === false || /network-request-failed|Connexion au serveur impossible|timeout/i.test(c)) return null;
  return 'erreur ' + ((e && e.code) || (e && e.message) || 'inconnue') + '. Menu ☰ → Diagnostic pour le détail.';
}
function showBanner(text, action, fn, onDismiss) {
  const b = $('#banner'); b.dataset.kind = ''; b.innerHTML = '<span>' + esc(text) + '</span>' + (action ? '<button>' + esc(action) + '</button>' : '') + '<button aria-label="Fermer">✕</button>';
  b.hidden = false;
  const btns = b.querySelectorAll('button');
  if (action) btns[0].onclick = fn;
  btns[btns.length - 1].onclick = () => { b.hidden = true; if (onDismiss) onDismiss(); };
}
// Mise à jour de l'appli : la nouvelle version s'installe en arrière-plan, on propose de recharger
function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (IN_APP || !hadController || reloading) return; reloading = true; if (S.sortie) saveSortieState(); location.reload(); });
  navigator.serviceWorker.register(IN_APP ? 'sw.js?native=1' : 'sw.js').then(reg => {
    const offer = w => { if (w && navigator.serviceWorker.controller && !IN_APP) showBanner('Une nouvelle version de l\'appli est prête.', 'Mettre à jour', () => w.postMessage('skipWaiting')); };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); }); });
    setInterval(() => reg.update().catch(() => {}), 3600e3);
  }).catch(e => log('Service worker : ' + e.message));
}

// ---------------------------------------------------------------- abonnements
const GROUP_WATCHES = ['membres', 'positions', 'trouvailles du groupe', 'carnets', 'alertes', 'trésors'];
let lostGroup = false;
function startUserWatchers() {
  // Hors réseau, Firestore peut d'abord répondre « absent » depuis son cache : on attend la réponse du serveur
  S.sync.watchMe((d, meta) => {
    S.me = d; S.meLoaded = true; onProfileData();
    clearTimeout(onboardT);
    if (!d && !onboardShown) onboardT = setTimeout(() => { if (!S.me && !onboardShown) startOnboarding(); }, meta && meta.fromCache ? 5000 : 0);
  });
  S.sync.watchMyFinds(list => { S.myFinds = list; S.loadedFinds = true; onProfileData(); renderFinds(); });
  S.sync.watchMySorties(list => { S.mySorties = list; S.loadedSorties = true; onProfileData(); renderTracksAndFog(); });
  if (S.gid) watchGroup(S.gid);
}
function watchGroup(gid) {
  S.unsubGroup.forEach(u => { try { u(); } catch (e) { /* ignore */ } });
  S.unsubGroup = [];
  S.gid = gid; store.set('cc.gid', gid);
  if (S.me && hasAccounts() && (S.me.gid || null) !== (gid || null)) { S.me.gid = gid || null; S.sync.saveMe({ gid: gid || null }).catch(() => {}); }
  S.group = null; S.members = []; S.presence = []; S.groupFinds = []; S.carnets = []; S.events = []; S.treasures = [];
  if (!gid) { renderAllGroup(); return; }
  const u = S.unsubGroup;
  u.push(S.sync.watchGroup(gid, (g, meta) => { S.group = g; if (!g && !(meta && meta.fromCache)) { toast('Ce groupe n\'existe plus.'); watchGroup(null); return; } renderPanelIfOpen('groupe'); }));
  u.push(S.sync.watchMembers(gid, list => { S.members = list; if (S.meLoaded && S.me && !list.some(m => m.id === S.uid)) { log('Membre absent du groupe'); } renderPanelIfOpen('groupe'); renderFriends(); }));
  u.push(S.sync.watchPresence(gid, list => { S.presence = list; renderFriends(); routeFollowFriend(); }));
  u.push(S.sync.watchGroupFinds(gid, list => { S.groupFinds = list; renderFinds(); renderPanelIfOpen('groupe'); }));
  u.push(S.sync.watchCarnets(gid, list => { S.carnets = list; renderTracksAndFog(); renderPanelIfOpen('groupe'); }));
  u.push(S.sync.watchEvents(gid, Date.now() - 2 * 3600e3, list => { onEvents(list); }));
  u.push(S.sync.watchTreasures(gid, list => { S.treasures = list; renderTreasures(); renderPanelIfOpen('groupe'); }));
  memberSync(true);
}
function renderAllGroup() { renderFriends(); renderFinds(); renderTreasures(); renderTracksAndFog(); M && M.layers.events.clearLayers(); renderPanelIfOpen('groupe'); }

// ---------------------------------------------------------------- profil, points, badges
let memberT = null, lastMember = '';
function memberSync(force) {
  if (!S.gid || !S.sync || !S.me) return;
  clearTimeout(memberT);
  memberT = setTimeout(() => {
    const p = memberPayload();
    const key = JSON.stringify([p.name, p.avatar, p.xp, p.level]);
    if (!force && key === lastMember) return;
    lastMember = key;
    S.sync.updateMember(S.gid, p).catch(() => {});
  }, force ? 50 : 1500);
}
let gidChecked = false;
function onProfileData() {
  if (!S.meLoaded) return;
  // groupe du compte (connecté sur un autre téléphone) ; les anciens profils l'apprennent ici
  if (S.me && hasAccounts() && !gidChecked) {
    gidChecked = true;
    if (S.me.gid && S.me.gid !== S.gid) watchGroup(S.me.gid);
    else if (!S.me.gid && S.gid) { S.me.gid = S.gid; S.sync.saveMe({ gid: S.gid }).catch(() => {}); }
  }
  const prof = Game.computeProfile(S.myFinds, S.mySorties, S.me || {});
  const prev = S.prof; S.prof = prof;
  const ready = S.loadedFinds && S.loadedSorties;
  if (ready && S.me && (S.me.xp !== prof.xp || S.me.level !== prof.level || JSON.stringify(S.me.badges || []) !== JSON.stringify(prof.badges))) S.sync.saveMe({ xp: prof.xp, level: prof.level, badges: prof.badges }).catch(() => {});
  if (ready) {
    if (S.badgesSeen) {
      const nb = prof.badges.filter(b => !S.badgesSeen.has(b));
      if (nb.length) { const b = Game.BADGES.find(x => x.id === nb[0]); setTimeout(() => toast('Nouveau badge : ' + b.n + ' !', 4000), 1800); vibrate([60, 40, 60]); }
      if (prev && prof.level > prev.level) later(() => celebrateLevel(prof));
    }
    S.badgesSeen = new Set(prof.badges);
  }
  if (S.me && ready) memberSync();
  if (S.me) askLocation();
  if (S.me && ready) askProtect();
  renderMe();
  updateTabAvatar(); renderPanelIfOpen('profil'); renderPanelIfOpen('mycodex');
}
function updateTabAvatar() { const im = $('#tab-avatar'); if (im && S.me && Av) im.src = avatarImg(S.me.avatar, 64); }
function onAvatarsReady() { updateTabAvatar(); renderFriends(); renderFinds(); if (S.tab !== 'carte') renderPanel(S.tab); renderMe(); }

// ---------------------------------------------------------------- fenêtres
let modalClose = null;
function openModal(html, onClose) {
  closeModal(true);
  // Nouveau conteneur à chaque fenêtre : les écouteurs d'une fenêtre fermée disparaissent avec elle
  const card = $('#modal-card');
  card.textContent = '';
  const box = document.createElement('div'); box.className = 'modal-box'; box.innerHTML = html;
  card.appendChild(box); $('#modal').hidden = false; card.scrollTop = 0;
  modalClose = onClose || null;
  return box;
}
function closeModal(silent) {
  if ($('#modal').hidden) return;
  $('#modal').hidden = true;
  destroyStages('modal');
  const f = modalClose; modalClose = null;
  if (f) f();
  if (!silent && queued.length) setTimeout(() => { if ($('#modal').hidden && queued.length) queued.shift()(); }, 260);
}
// Une fenêtre à la fois : ce qui arrive pendant qu'une autre est ouverte attend son tour
const queued = [];
function later(fn) { if ($('#modal').hidden && $('#placing').hidden) fn(); else queued.push(fn); }
function modalHead(title, closable) { return '<div class="modal-head"><h2>' + esc(title) + '</h2>' + (closable === false ? '' : '<button class="icon-btn" data-act="modal-close" aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>') + '</div>'; }
function stage(canvas, cfg, opts, scope) {
  if (!Av || !canvas) return null;
  const st = new Av.AvatarStage(canvas, cfg, opts);
  st._scope = scope; S.stages.add(st);
  return st;
}
function destroyStages(scope) { for (const s of [...S.stages]) if (!scope || s._scope === scope) { s.destroy(); S.stages.delete(s); } }

// ---------------------------------------------------------------- accueil et création d'avatar
let onboardShown = false, onboardT = null;
async function startOnboarding() {
  onboardShown = true;
  await avP;
  const cfg = Av ? Av.randomAvatar() : {};
  const card = openModal(modalHead('Bienvenue !', false) +
    '<canvas class="editor-stage" id="ob-stage"></canvas>' +
    '<p style="margin:6px 0 0;font-size:15.5px">Créez votre champignon, rejoignez vos amis et partez à la chasse : positions en direct, trouvailles en photo, Mycodex à compléter et cèpes d\'or à dénicher.</p>' +
    (INAPP_BROWSER ? '<p class="warnbox" style="margin-top:10px">Ce lien s\'est ouvert dans le navigateur d\'une autre appli : ton champignon risque de ne pas y rester. Ouvre-le plutôt dans Chrome ou Safari (menu ⋮ ou ⋯ → « Ouvrir dans le navigateur »).</p>' : '') +
    '<div class="actions" style="flex-direction:column"><button class="btn primary block" data-act="ob-create">Créer mon champignon</button>' +
    (hasAccounts() ? '<button class="btn block" data-act="acc-login">J\'ai déjà un compte</button>' : '') + '</div>');
  stage(card.querySelector('#ob-stage'), cfg, { base: true }, 'modal');
  card.querySelector('[data-act="ob-create"]').onclick = () => openAvatarEditor(cfg, true);
}
function openAvatarEditor(initial, onboarding) {
  if (!Av) { toast('Avatars 3D indisponibles sur cet appareil.'); return; }
  let cfg = Av.normalizeAvatar(initial || (S.me && S.me.avatar) || Av.randomAvatar());
  let name = (S.me && S.me.name) || '';
  const chips = (key, dict) => Object.entries(dict).map(([k, v]) => '<button class="opt-chip" data-k="' + key + '" data-v="' + esc(k) + '" aria-pressed="' + (cfg[key] === k) + '">' + esc(v) + '</button>').join('');
  const capChips = Object.entries(Av.CAPS).filter(([k]) => k !== 'inconnu').map(([k, c]) => '<button class="opt-chip" data-k="cap" data-v="' + k + '" aria-pressed="' + (cfg.cap === k) + '"><img alt="" src="' + Av.speciesIcon(k, 64) + '">' + esc(c.n) + '</button>').join('');
  const html = modalHead(onboarding ? 'Votre champignon' : 'Modifier mon champignon', !onboarding) +
    '<canvas class="editor-stage" id="ed-stage" aria-label="Aperçu 3D, touchez-le pour le faire sauter"></canvas>' +
    '<div class="field"><label for="ed-name">Pseudo</label><input class="input" id="ed-name" maxlength="24" placeholder="Théo des bois" value="' + esc(name) + '"></div>' +
    '<div class="editor-sec"><h3>Espèce</h3><div class="opts" id="ed-caps">' + capChips + '</div></div>' +
    '<div class="editor-sec"><h3>Couleur du chapeau</h3><div class="opts" id="ed-tints"></div></div>' +
    '<div class="editor-sec"><h3>Yeux</h3><div class="opts">' + chips('eyes', Av.EYES) + '</div></div>' +
    '<div class="editor-sec"><h3>Bouche</h3><div class="opts">' + chips('mouth', Av.MOUTHS) + '</div></div>' +
    '<div class="editor-sec"><h3>Dans la main</h3><div class="opts">' + chips('acc', Av.ACCS) + '</div></div>' +
    '<div class="editor-sec"><h3>Sur le chapeau</h3><div class="opts">' + chips('head', Av.HEADS) + '</div></div>' +
    '<div class="editor-sec"><h3>Écharpe</h3><div class="opts" id="ed-scarf">' + Av.SCARVES.map(c => '<button class="swatch" data-k="scarf" data-v="' + (c || '') + '" aria-pressed="' + ((cfg.scarf || '') === (c || '')) + '" aria-label="' + (c ? 'Écharpe ' + c : 'Sans écharpe') + '" style="background:' + (c || 'repeating-linear-gradient(45deg,#ddd 0 4px,#fff 4px 8px)') + '"></button>').join('') + '</div></div>' +
    '<div class="editor-sec"><h3>Détails</h3><div class="toggle-row"><span>Joues roses</span><input type="checkbox" class="switch" id="ed-cheeks"' + (cfg.cheeks ? ' checked' : '') + '></div><div class="toggle-row"><span>Lunettes</span><input type="checkbox" class="switch" id="ed-glasses"' + (cfg.glasses ? ' checked' : '') + '></div></div>' +
    '<p class="note" id="ed-err" style="color:var(--danger)" hidden></p>' +
    '<div class="actions"><button class="btn" data-act="ed-random">Au hasard</button><button class="btn primary" data-act="ed-save" style="flex:1">' + (onboarding ? 'Continuer' : 'Enregistrer') + '</button></div>';
  const card = openModal(html);
  const st = stage(card.querySelector('#ed-stage'), cfg, { base: true }, 'modal');
  const tints = () => { card.querySelector('#ed-tints').innerHTML = Av.CAPS[cfg.cap].tints.map((c, i) => '<button class="swatch" data-k="tint" data-v="' + i + '" aria-pressed="' + (cfg.tint === i) + '" aria-label="Teinte ' + (i + 1) + '" style="background:' + c + '"></button>').join(''); };
  tints();
  const sync = (hop) => { card.querySelectorAll('[data-k]').forEach(b => { const k = b.dataset.k; const v = k === 'tint' ? +b.dataset.v : k === 'scarf' ? (b.dataset.v || null) : b.dataset.v; b.setAttribute('aria-pressed', String(cfg[k] === v)); }); if (st) { st.setConfig(cfg); if (hop) st.play('hop'); } };
  card.addEventListener('click', e => {
    const b = e.target.closest('[data-k]');
    if (b) { const k = b.dataset.k; cfg[k] = k === 'tint' ? +b.dataset.v : k === 'scarf' ? (b.dataset.v || null) : b.dataset.v; if (k === 'cap') { cfg.tint = 0; tints(); } sync(true); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'ed-random') { cfg = Av.randomAvatar(); card.querySelector('#ed-cheeks').checked = cfg.cheeks; card.querySelector('#ed-glasses').checked = cfg.glasses; tints(); sync(true); }
    if (a.dataset.act === 'ed-save') {
      name = card.querySelector('#ed-name').value.trim();
      if (!name) { const er = card.querySelector('#ed-err'); er.textContent = 'Choisissez un pseudo.'; er.hidden = false; card.querySelector('#ed-name').focus(); return; }
      cfg.cheeks = card.querySelector('#ed-cheeks').checked; cfg.glasses = card.querySelector('#ed-glasses').checked;
      const patch = { name: name.slice(0, 24), avatar: Av.normalizeAvatar(cfg) };
      if (!S.me) patch.createdAt = Date.now();
      S.sync.saveMe(patch).catch(() => {});
      S.me = Object.assign({}, S.me || {}, patch);
      memberSync(true); renderFriends(); renderMe();
      if (onboarding) { const a = accountOf(); if (a && a.anonymous) openProtect(() => openGroupChooser(true)); else openGroupChooser(true); } else { closeModal(); toast('Champignon enregistré'); }
    }
  });
  card.querySelector('#ed-cheeks').onchange = e => { cfg.cheeks = e.target.checked; sync(); };
  card.querySelector('#ed-glasses').onchange = e => { cfg.glasses = e.target.checked; sync(); };
  card.querySelector('#ed-name').addEventListener('input', () => { card.querySelector('#ed-err').hidden = true; });
}
function openGroupChooser(onboarding) {
  const solo = S.sync && S.sync.kind === 'local';
  const card = openModal(modalHead('Jouer en groupe', !onboarding) +
    (solo ? '<p class="warnbox">Mode solo : le groupe ne se partage pas encore entre téléphones. Une fois l\'appli reliée à Firebase, vos amis vous rejoindront avec le code.</p>' : '<p>Créez un groupe et partagez son code à vos amis, ou entrez le code qu\'ils vous ont donné.</p>') +
    '<div class="card" style="margin-top:10px"><h3>Rejoindre</h3><div class="row"><input class="input grow" id="gj-code" maxlength="12" placeholder="Code : K7M2Q9XA" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase"><button class="btn primary" data-act="gj-join">Rejoindre</button></div></div>' +
    '<div class="card" style="margin-top:10px"><h3>Créer</h3><div class="row"><input class="input grow" id="gc-name" maxlength="30" placeholder="Les chasseurs du Warndt"><button class="btn" data-act="gc-create">Créer</button></div></div>' +
    '<p class="note" id="g-err" style="color:var(--danger);margin-top:8px" hidden></p>' +
    (onboarding ? '<div class="actions"><button class="btn block" data-act="modal-close">Plus tard</button></div>' : ''));
  const err = m => { const e = card.querySelector('#g-err'); e.textContent = m; e.hidden = !m; };
  card.querySelector('[data-act="gj-join"]').onclick = async () => {
    const code = card.querySelector('#gj-code').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 6) { err('Le code fait 8 caractères.'); return; }
    err(''); try { const g = await S.sync.joinGroup(code, memberPayload()); watchGroup(code); closeModal(); toast('Bienvenue dans « ' + (g.name || code) + ' »'); }
    catch (e) { err(e.code === 'not-found' && !/database/i.test(e.message || '') ? 'Aucun groupe ne porte ce code.' : 'Impossible de rejoindre : ' + fbWhy(e)); }
  };
  card.querySelector('[data-act="gc-create"]').onclick = async () => {
    const name = card.querySelector('#gc-name').value.trim();
    if (!name) { err('Donnez un nom au groupe.'); return; }
    err(''); try { const gid = await S.sync.createGroup(name.slice(0, 30), memberPayload()); watchGroup(gid); closeModal(); openTab('groupe'); toast('Groupe créé : partagez le code ' + gid); }
    catch (e) { err('Création impossible : ' + fbWhy(e)); }
  };
}
const profReady = () => !!(S.prof && S.loadedFinds && S.loadedSorties);

// ---------------------------------------------------------------- compte : e-mail et mot de passe
// Chaque appareil commence avec un compte anonyme. En ajoutant un e-mail et un mot de passe, le joueur garde le
// même compte (profil, points, trouvailles, groupe) et le retrouve en se connectant ailleurs : autre téléphone,
// appli Android, site.
const INAPP_BROWSER = !IN_APP && /FBAN|FBAV|Instagram|Line\/|Snapchat|; wv\)/i.test(navigator.userAgent);
const hasAccounts = () => !!(S.sync && S.sync.kind === 'firebase' && S.sync.auth);
const accountOf = () => (hasAccounts() ? S.sync.account : null);
function authWhy(e) {
  const c = (e && e.code) || '';
  if (/email-already-in-use|credential-already-in-use|account-exists/.test(c)) return 'Cette adresse a déjà un compte : touche « J\'ai déjà un compte » pour te connecter.';
  if (/invalid-email|missing-email/.test(c)) return 'Adresse e-mail invalide.';
  if (/weak-password|missing-password/.test(c)) return 'Mot de passe trop court : 6 caractères au moins.';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'E-mail ou mot de passe incorrect.';
  // deux réglages de Firebase peuvent bloquer : le fournisseur e-mail (premier interrupteur) et l'inscription
  if (/operation-not-allowed/.test(c)) return 'Firebase refuse les comptes e-mail + mot de passe : Authentication → Méthode de connexion → crayon de « Adresse e-mail/Mot de passe » → active le PREMIER interrupteur (pas seulement « Lien par e-mail ») → Enregistrer. (' + c + ')';
  if (/admin-restricted/.test(c)) return 'Firebase refuse la création de comptes : Authentication → Paramètres → Actions de l\'utilisateur → coche « Activer la création (inscription) » → Enregistrer. (' + c + ')';
  if (/too-many-requests/.test(c)) return 'Trop d\'essais : réessaie dans quelques minutes.';
  if (/network-request-failed/.test(c) || navigator.onLine === false) return 'Pas de réseau : réessaie quand tu as du réseau.';
  if (/provider-already-linked/.test(c)) return 'Ce champignon a déjà un compte.';
  if (/user-disabled/.test(c)) return 'Ce compte est désactivé.';
  return 'Erreur : ' + (c || (e && e.message) || 'inconnue') + '.';
}
const pwField = (id, ac) => '<div class="pw-row"><input class="input" id="' + id + '" type="password" minlength="6" autocomplete="' + ac + '"' + (ac === 'new-password' ? ' placeholder="6 caractères au moins"' : '') + ' required><button class="btn" type="button" data-act="pw-show" data-for="' + id + '">Voir</button></div>';
function accountCard() {
  const a = accountOf(); if (!a) return '';
  if (a.anonymous) return '<div class="card"><h3>Mon compte</h3><p>Ton champignon n\'est enregistré que sur ' + (IN_APP ? 'cette appli' : 'ce navigateur') + '. Crée ton compte (e-mail et mot de passe) pour le retrouver sur un autre téléphone, dans l\'appli Android ou sur le site.</p><div class="actions"><button class="btn primary" data-act="acc-protect">Créer mon compte</button><button class="btn" data-act="acc-login">J\'ai déjà un compte</button></div></div>';
  return '<div class="card"><h3>Mon compte</h3><p>Connecté avec <b>' + esc(a.email) + '</b>. Connecte-toi avec cette adresse sur un autre téléphone, dans l\'appli Android ou sur le site : tu y retrouveras ton champignon et ton groupe.</p><div class="actions"><button class="btn" data-act="acc-reset">Changer de mot de passe</button><button class="btn" data-act="acc-logout">Me déconnecter</button></div></div>';
}
// Ajouter un e-mail et un mot de passe au compte de cet appareil
function openProtect(onDone) {
  const card = openModal(modalHead('Garder mon champignon', !onDone) +
    '<p>Ajoute un e-mail et un mot de passe : tu retrouveras ton champignon, tes points et ton groupe sur un autre téléphone, dans l\'appli Android ou sur le site.</p>' +
    '<form id="pr-form" novalidate><div class="field"><label for="pr-mail">E-mail</label><input class="input" id="pr-mail" type="email" autocomplete="email" inputmode="email" placeholder="toi@exemple.fr" required></div>' +
    '<div class="field"><label for="pr-pw">Mot de passe</label>' + pwField('pr-pw', 'new-password') + '</div>' +
    '<p class="note" id="pr-err" style="color:var(--danger)" hidden></p>' +
    '<div class="actions" style="flex-direction:column"><button class="btn primary block" type="submit">Créer mon compte</button>' + (onDone ? '<button class="btn block" type="button" data-act="pr-later">Plus tard</button>' : '') + '</div></form>' +
    '<p class="note" style="margin-top:10px">Ton e-mail ne sert qu\'à te connecter et à retrouver ton mot de passe ; il n\'est montré à personne.</p>');
  const err = m => { const el = card.querySelector('#pr-err'); el.textContent = m; el.hidden = !m; };
  const later_ = card.querySelector('[data-act="pr-later"]');
  if (later_) later_.onclick = () => { store.set('cc.protectAsk', Date.now()); onDone(); };
  card.querySelector('#pr-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = card.querySelector('#pr-mail').value.trim(), pw = card.querySelector('#pr-pw').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err('Adresse e-mail invalide.'); return; }
    if (pw.length < 6) { err('Mot de passe trop court : 6 caractères au moins.'); return; }
    const btn = card.querySelector('button[type="submit"]'); btn.disabled = true; err('');
    try {
      await S.sync.protect(email, pw);
      log('Compte créé : ' + email);
      toast('Compte créé : connecte-toi avec ' + email + ' sur tes autres appareils.', 6000);
      renderPanelIfOpen('profil');
      if (onDone) onDone(); else closeModal();
    } catch (e) { btn.disabled = false; err(authWhy(e)); log('Compte : ' + (e.code || e.message)); }
  });
}
// Se connecter à son compte sur cet appareil
function openLogin() {
  const card = openModal(modalHead('Me connecter') +
    '<p>Connecte-toi pour retrouver ton champignon, tes points et ton groupe.</p>' +
    '<form id="lg-form" novalidate><div class="field"><label for="lg-mail">E-mail</label><input class="input" id="lg-mail" type="email" autocomplete="username" inputmode="email" required></div>' +
    '<div class="field"><label for="lg-pw">Mot de passe</label>' + pwField('lg-pw', 'current-password') + '</div>' +
    '<p class="warnbox" id="lg-warn" hidden></p><p class="note" id="lg-err" style="color:var(--danger)" hidden></p>' +
    '<div class="actions"><button class="btn primary block" type="submit">Me connecter</button></div></form>' +
    '<p class="note" style="margin-top:10px"><a href="#" data-act="lg-forgot">Mot de passe oublié ?</a></p>',
    () => { if (!S.me && !loggingIn) setTimeout(() => { if (!S.me && $('#modal').hidden) startOnboarding(); }, 250); });
  const err = m => { const el = card.querySelector('#lg-err'); el.textContent = m; el.hidden = !m; };
  let confirmed = false, loggingIn = false;
  card.querySelector('[data-act="lg-forgot"]').onclick = async ev => {
    ev.preventDefault();
    const email = card.querySelector('#lg-mail').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err('Écris d\'abord ton e-mail ci-dessus.'); return; }
    try { await S.sync.resetPassword(email); err(''); toast('E-mail envoyé à ' + email + ' : suis le lien pour choisir un nouveau mot de passe (regarde aussi dans les indésirables).', 8000); }
    catch (e) { err(authWhy(e)); }
  };
  card.querySelector('#lg-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = card.querySelector('#lg-mail').value.trim(), pw = card.querySelector('#lg-pw').value;
    if (!email || !pw) { err('Écris ton e-mail et ton mot de passe.'); return; }
    const acc = accountOf();
    const xp = S.prof ? S.prof.xp : 0, throwaway = !S.me || (xp === 0 && !S.myFinds.length && !S.mySorties.length);
    // un vrai champignon sur cet appareil (sans compte) : on prévient avant de le remplacer
    if (acc && acc.anonymous && !throwaway && !confirmed) {
      const w = card.querySelector('#lg-warn');
      w.textContent = 'Ce téléphone a déjà le champignon « ' + (S.me.name || '') + ' » (' + xp + ' points), sans compte. En te connectant, il sera remplacé par celui de ton compte.';
      w.hidden = false; confirmed = true;
      card.querySelector('button[type="submit"]').textContent = 'Me connecter quand même';
      return;
    }
    const btn = card.querySelector('button[type="submit"]'); btn.disabled = true; err('');
    const prev = acc && acc.anonymous ? { user: S.sync.auth.currentUser, gid: S.gid, throwaway } : null;
    if (prev) prev.token = await prev.user.getIdToken().catch(() => null);
    try { loggingIn = true; await S.sync.login(email, pw); }
    catch (e) { loggingIn = false; btn.disabled = false; err(authWhy(e)); log('Connexion au compte : ' + (e.code || e.message)); return; }
    btn.textContent = 'Connecté, chargement…';
    if (prev && prev.token) await cleanAnonymous(prev);
    if (S.sortie) { S.sortie = null; saveSortieState(); }
    store.set('cc.gid', null);   // le groupe vient du profil du compte
    location.reload();
  });
}
// Le compte anonyme qu'on quitte : retiré du groupe (pas de doublon dans la liste), effacé s'il était vide
async function cleanAnonymous(prev) {
  const cfg = S.sync.config || FIREBASE_CONFIG; if (!cfg) return;
  const base = 'https://firestore.googleapis.com/v1/projects/' + cfg.projectId + '/databases/(default)/documents/';
  const del = path => fetch(base + path, { method: 'DELETE', headers: { Authorization: 'Bearer ' + prev.token } }).catch(() => null);
  if (prev.gid) { await del('groups/' + prev.gid + '/presence/' + prev.user.uid); await del('groups/' + prev.gid + '/members/' + prev.user.uid); }
  if (prev.throwaway) {
    await del('users/' + prev.user.uid);
    await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + encodeURIComponent(cfg.apiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: prev.token }) }).catch(() => null);
  }
}
async function accReset(btn) {
  const a = accountOf(); if (!a || !a.email) return;
  try { await S.sync.resetPassword(a.email); btn.disabled = true; toast('E-mail envoyé à ' + a.email + ' : suis le lien pour choisir un nouveau mot de passe.', 7000); }
  catch (e) { toast(authWhy(e), 6000); }
}
async function doLogout() {
  if (S.sortie) { toast('Termine d\'abord ta sortie.'); return; }
  try { if (S.gid) await S.sync.setPresence(S.gid, { sharing: false, ts: Date.now() }).catch(() => {}); await S.sync.logout(); } catch (e) { /* on recharge quand même */ }
  store.set('cc.gid', null);
  location.reload();
}
// Rappel discret : un joueur sans compte qui a déjà un groupe ou des points (au plus une fois par semaine)
let protectAsked = false;
function askProtect() {
  if (protectAsked) return;
  const a = accountOf(); if (!a || !a.anonymous || !S.me || !(S.gid || (S.prof && S.prof.xp > 0))) return;
  if (Date.now() - store.get('cc.protectAsk', 0) < 7 * 86400e3) return;
  protectAsked = true;
  setTimeout(() => {
    if (!$('#banner').hidden || !$('#modal').hidden) { protectAsked = false; return; }
    store.set('cc.protectAsk', Date.now());
    showBanner('Crée ton compte pour garder ton champignon si tu changes de téléphone ou passes à l\'appli.', 'Créer', () => { $('#banner').hidden = true; openProtect(); });
  }, 6000);
}
// Erreurs Firestore expliquées simplement
function fbWhy(e) {
  const c = ((e && e.code) || '') + ' ' + ((e && e.message) || '');
  if (/does not exist|database.*not.*exist/i.test(c)) return 'la base de données Firestore n\'existe pas encore (Firebase → Firestore Database → Créer une base de données).';
  if (/permission/i.test(c)) return 'accès refusé par les règles Firestore : vérifie qu\'elles sont bien publiées.';
  if (/unavailable|offline|network/i.test(c)) return 'pas de réseau pour joindre le serveur du jeu.';
  return (e && (e.message || e.code)) || String(e);
}
const memberPayload = () => ({ name: (S.me && S.me.name) || 'Cueilleur', avatar: (S.me && S.me.avatar) || {}, xp: profReady() ? S.prof.xp : (S.me && S.me.xp) || 0, level: profReady() ? S.prof.level : (S.me && S.me.level) || 1, lastSeen: Date.now() });
function openInfoSolo() {
  openModal(modalHead('Mode solo') + '<p>L\'appli n\'est pas encore reliée à un serveur Firebase. Tout fonctionne (avatar, trouvailles, Mycodex, sorties), mais les données restent sur ce téléphone et le groupe ne se partage pas.</p><p class="note">Une fois la configuration Firebase ajoutée à l\'appli, chaque joueur garde son profil et le jeu devient collectif en direct.</p>');
}

// ---------------------------------------------------------------- espèces, mode, feuille du bas
function buildRail() {
  const order = C.SPECIES.map(s => ({ s, w: C.seasonOf(s, MONTH) })).sort((a, b) => b.w - a.w);
  const chip = (id, label, w) => '<button class="chip' + (w <= 0 ? ' off' : '') + '" data-sp="' + id + '" data-season="' + (w >= 0.6 ? 'hi' : w > 0 ? 'mid' : 'off') + '" aria-pressed="' + (S.sp === id) + '"><span class="dot"></span>' + esc(label) + '</button>';
  $('#rail').innerHTML = chip('all', 'De saison', 1) + order.map(o => chip(o.s.id, o.s.n, o.w)).join('');
}
function selectSp(id) {
  S.sp = id; store.set('cc.sp', id);
  document.querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.sp === id ? 'true' : 'false'));
  if (S.mode === 'bio') setMode('pot');
  M.setSpecies(id); updatePeek(); refreshMore();
  if (S.tab !== 'carte') openTab('carte');
}
function setMode(m) {
  S.mode = m;
  $('#mode-pot').setAttribute('aria-selected', m === 'pot'); $('#mode-bio').setAttribute('aria-selected', m === 'bio');
  M.setMode(m); updatePeek(); refreshMore();
}
function setSheet(s) { S.sheet = s; $('#sheet').dataset.state = s; $('#handle').setAttribute('aria-expanded', s === 'open' ? 'true' : 'false'); placeFabs(); }
function placeFabs() {
  if (window.matchMedia && window.matchMedia('(min-width: 760px)').matches) { $('#fabs').style.bottom = ''; return; }
  $('#fabs').style.bottom = (Math.min($('#sheet').offsetHeight, $('#stage').clientHeight * 0.55) + 12) + 'px';
}
const spObj = () => C.SPECIES.find(s => s.id === S.sp) || null;
function wxLabel() {
  if (!S.wx) return { t: S.wxErr ? 'Météo indisponible' : 'Météo…', c: 'off' };
  const sp = spObj();
  if (sp) return C.pousseLabel(C.pousse(sp, S.wx, MONTH));
  let best = null;
  for (const s of C.SPECIES) { const r = C.pousse(s, S.wx, MONTH); if (r.season > 0 && (!best || (r.idx || 0) > (best.idx || 0))) best = r; }
  return best ? C.pousseLabel(best) : { t: 'Hors saison', c: 'off' };
}
function updatePeek() {
  if (!M) return;
  const sp = spObj();
  $('#peek-title').textContent = S.mode === 'bio' ? 'Peuplements forestiers' : sp ? sp.n : 'Coins de saison';
  const pill = $('#peek-pill'), lab = wxLabel();
  pill.textContent = lab.t; pill.className = 'pill ' + lab.c; pill.hidden = S.mode === 'bio';
  const st = $('#status');
  if (M.map.getZoom() < M.DATA_Z) { st.innerHTML = farStatus(); return; }
  const tc = M.tileCounts(), parts = [];
  if (tc && tc.wait) parts.push('Chargement des forêts… ' + tc.ok + '/' + tc.total);
  if (tc && tc.err) parts.push('<span>' + tc.err + ' zone(s) en erreur</span> <button class="linkish" data-act="retry">Réessayer</button>');
  if (M.st.srcErr && (!tc || !tc.ok)) parts.push('<span>Données forestières IGN injoignables.</span> <button class="linkish" data-act="diag">Diagnostic</button>');
  const vs = M.stats();
  if (vs && vs.known) {
    if (!vs.forest && tc && !tc.wait) parts.push('Pas de forêt dans cette vue');
    else if (S.mode === 'bio') { const top = Object.entries(vs.groups).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g, n]) => C.GROUPS[C.GKEYS[g - 1]].n + ' ' + Math.round(100 * n / vs.forest) + ' %'); if (top.length) parts.push(esc(top.join(' · '))); }
    else if (vs.forest) parts.push('≈ ' + fmtHa(vs.lv[3] * vs.ha) + ' de coins forts, ' + fmtHa(vs.lv[2] * vs.ha) + ' bons dans l\'écran');
  }
  st.innerHTML = parts.join(' · ') || '&nbsp;';
}
// ---------------------------------------------------------------- vue de loin (zooms 5 à 12)
const dateCourte = iso => { const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }); };
function farStatus() {
  const fs = M.far.state, z = M.map.getZoom(), more = ' <button class="linkish" data-act="massifs">Choisir un massif</button>';
  if (!fs.idx) return 'Zoomez sur un massif forestier pour calculer les coins.' + more;
  if (z < M.FAR_Z) {
    if (S.mode === 'bio') return 'Forêts de France : peuplement dominant. Zoomez sur une région.';
    if (fs.coarse !== 'ok') return 'Chargement de la carte de France…';
    return (M.far.wxOn && fs.wxDate ? 'Ça pousse en ce moment (météo du ' + esc(dateCourte(fs.wxDate)) + ')' : 'Coins de France d\'après les forêts et le sol') + ' · zoomez sur une région';
  }
  return (fs.wait ? 'Chargement des forêts… · ' : '') + 'Vue d\'ensemble en cases de 250 m · zoomez pour le détail';
}
function farLegend() {
  const z = M.map.getZoom(), sw = c => '<i class="sw" style="background:' + c + '"></i>';
  if (S.mode === 'bio') return '<h3>Légende</h3><div class="legend">' + ['HET', 'CHE', 'FMX', 'CHA', 'SEP', 'PSY', 'PIN', 'DOU', 'MXF', 'MXC', 'PEU', 'LAN'].map(k => '<span>' + sw(C.GROUPS[k].c) + esc(C.GROUPS[k].n) + '</span>').join('') + '</div><p class="note" style="margin-top:8px">' + (z < M.FAR_Z ? 'Peuplement le plus présent dans chaque case d\'environ 5 km (plus la couleur est franche, plus la case est boisée).' : 'Peuplement dominant de chaque case d\'environ 250 m.') + ' D\'après la BD Forêt V2 de l\'IGN.</p>';
  const lv = '<span>' + sw(POT_COL[3]) + (z < M.FAR_Z ? 'Très favorable' : 'Coin fort') + '</span><span>' + sw(POT_COL[2]) + (z < M.FAR_Z ? 'Favorable' : 'Bon') + '</span>' + (S.showLow ? '<span>' + sw(POT_COL[1]) + 'Possible</span>' : '');
  if (z < M.FAR_Z) {
    const fs = M.far.state;
    return '<h3>Ça pousse</h3><div class="legend">' + lv + '</div>' +
      '<label class="opt" style="margin-top:8px"><input type="checkbox" data-act="far-wx"' + (S.farWx ? ' checked' : '') + '> <span>Tenir compte de la météo<small>' + (fs.wxDate ? 'Pluie des 14 derniers jours, températures et gel, au ' + esc(dateCourte(fs.wxDate)) : 'Météo du jour en chargement…') + '</small></span></label>' +
      '<p class="note" style="margin-top:8px">Chaque case fait environ 5 km : part de bons coins (peuplements de la BD Forêt, sol, lisières)' + (S.farWx ? ' × conditions de pousse de l\'espèce' : '') + '. Zoomez : à partir de la région, les coins s\'affichent en cases de 250 m, puis en détail.</p>';
  }
  return '<h3>Légende</h3><div class="legend">' + lv + '</div><p class="note" style="margin-top:8px">Vue d\'ensemble en cases d\'environ 250 m, calculée pour toute la France (peuplement dominant, sol, lisières). Zoomez encore pour la carte détaillée en direct.</p>';
}
let farNamesT = null;
function farBest() {
  if (M.map.getZoom() >= M.DATA_Z || S.mode === 'bio') return '';
  const fs = M.far.state, list = M.far.best(5), z = M.map.getZoom();
  const head = '<h3 style="margin-top:14px">' + (z < M.FAR_Z && S.farWx ? 'Où ça pousse dans la vue' : 'Meilleurs secteurs dans la vue') + '</h3>';
  if (!list.length) return head + '<p class="note">' + (fs.coarse === 'ok' ? 'Aucun secteur favorable dans la vue pour le moment.' : 'Chargement de la carte de France…') + '</p>';
  return head + '<div class="list">' + list.map((p, i) => {
    const nm = M.communeCached(p.lat, p.lon);
    if (!nm) M.communeAt(p.lat, p.lon).then(n => { if (n) { clearTimeout(farNamesT); farNamesT = setTimeout(renderSp, 150); } });
    const lab = p.score >= 0.75 ? 'Très favorable' : p.score >= 0.45 ? 'Favorable' : 'Possible';
    return '<button class="li far-li" data-act="far-go" data-lat="' + p.lat.toFixed(4) + '" data-lon="' + p.lon.toFixed(4) + '"><b class="far-n">' + (i + 1) + '</b><div class="grow">' + esc(nm ? 'Autour de ' + nm : 'Secteur ' + p.lat.toFixed(2) + ', ' + p.lon.toFixed(2)) + '<small>' + lab + '</small></div><span class="note">Voir</span></button>';
  }).join('') + '</div>';
}
function refreshMore() { if (!M) return; renderWx(); renderSp(); renderLegend(); if (S.point) renderPoint(); }
function renderWx() {
  const el = $('#sec-wx'), sp = spObj(), wx = S.wx;
  let h = '<h3>Conditions de pousse</h3>';
  if (!wx) { el.innerHTML = h + '<p class="note">' + (S.wxErr ? 'Météo indisponible pour le moment (' + esc(S.wxErr) + ').' : 'Chargement de la météo du secteur…') + '</p>'; return; }
  const f = v => v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('fr-FR');
  h += '<dl class="kv"><dt>Pluie 14 derniers jours</dt><dd>' + f(wx.r14) + ' mm</dd><dt>Dont 3 derniers jours</dt><dd>' + f(wx.r3) + ' mm</dd><dt>Température moy. 7 jours</dt><dd>' + f(wx.t7) + ' °C</dd><dt>Gelées (5 jours)</dt><dd>' + (wx.frost5 ? wx.frost5 + ' nuit(s)' : 'aucune') + '</dd><dt>Pluie prévue 7 jours</dt><dd>' + f(wx.f7) + ' mm</dd></dl>';
  const list = sp ? [sp] : C.SPECIES.filter(s => C.seasonOf(s, MONTH) > 0);
  if (list.length) {
    h += '<div class="bars" style="margin-top:12px">' + list.map(s => ({ s, r: C.pousse(s, wx, MONTH) })).sort((a, b) => (b.r.idx || 0) - (a.r.idx || 0)).map(({ s, r }) => { const v = Math.round(100 * (r.idx || 0)); return '<div class="bar"><span class="t' + (r.season ? '' : ' off') + '">' + esc(s.n) + '</span><i><b style="width:' + v + '%;background:' + (v >= 55 ? 'var(--good)' : v >= 30 ? 'var(--mid)' : 'var(--low)') + '"></b></i><span class="v">' + v + '</span></div>'; }).join('') + '</div>';
    h += '<p class="note" style="margin-top:8px">Indice 0–100 : saison × pluie des 14 jours × température × gel, pour ' + esc(S.wxAt || 'le centre de la carte') + '.</p>';
  }
  el.innerHTML = h;
}
function renderSp() {
  const el = $('#sec-sp'), sp = spObj();
  if (S.mode === 'bio') { el.innerHTML = '<h3>Mode biotope</h3><p>Chaque case est colorée selon le peuplement forestier de la BD Forêt. Touchez la carte pour le détail d\'un point.</p>'; return; }
  if (!sp) {
    const vs = M.stats();
    let h = '<h3>Champignons de saison</h3><p>Les coins forts sont favorables à au moins deux espèces de saison. Choisissez une espèce pour sa carte à elle.</p>';
    if (vs && vs.forest) {
      const rows = C.SPECIES.map((s, i) => ({ s, ha: vs.perSp[i] * vs.ha, on: C.seasonOf(s, MONTH) > 0 })).filter(r => r.on).sort((a, b) => b.ha - a.ha);
      const max = Math.max(1e-9, ...rows.map(r => r.ha));
      h += '<div class="bars">' + rows.map(r => '<div class="bar"><span class="t">' + esc(r.s.n) + '</span><i><b style="width:' + Math.round(100 * r.ha / max) + '%;background:' + POT_COL[2] + '"></b></i><span class="v">' + (r.ha >= 10 ? Math.round(r.ha) : Math.round(r.ha * 10) / 10) + '</span></div>').join('') + '</div><p class="note" style="margin-top:8px">Hectares de coins forts dans l\'écran.</p>';
    }
    el.innerHTML = h + farBest(); return;
  }
  const months = Object.keys(sp.m).map(Number).sort((a, b) => a - b);
  const mn = m => new Date(2000, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '');
  el.innerHTML = '<h3>Où chercher</h3><div class="title">' + esc(sp.n) + '</div><div class="latin">' + esc(sp.lat) + '</div><p>' + esc(sp.hab) + '</p><p class="note">Saison : ' + months.map(m => m === MONTH ? '<b>' + mn(m) + '</b>' : mn(m)).join(' · ') + (C.seasonOf(sp, MONTH) ? '' : ' — hors saison : utile pour repérer les coins à l\'avance.') + '</p><div class="warnbox"><b>Confusions :</b> ' + esc(sp.conf) + '</div>' + farBest();
}
function soilLegend() {
  if (!$('#lyr-soil') || !$('#lyr-soil').checked) return '';
  return '<h3 style="margin-top:14px">Sol estimé</h3><div class="legend">' + [1, 2, 3, 4].map(c => '<span><i class="sw" style="background:' + SOIL_COLORS[c] + '"></i>' + esc(C.LITHO[c].n) + ' <small class="note">' + esc(C.LITHO[c].d) + '</small></span>').join('') + '</div><p class="note" style="margin-top:8px">D\'après la roche du sous-sol (carte géologique de la France au 1/1 000 000, BRGM).</p>';
}
function renderLegend() {
  const el = $('#sec-legend');
  renderLegendMain(el);
  el.insertAdjacentHTML('beforeend', soilLegend());
}
function renderLegendMain(el) {
  if (M.map.getZoom() < M.DATA_Z) { el.innerHTML = farLegend(); return; }
  if (S.mode === 'bio') {
    const vs = M.stats(), present = vs ? Object.keys(vs.groups).map(Number).sort((a, b) => vs.groups[b] - vs.groups[a]) : [];
    const keys = present.length ? present.map(g => C.GKEYS[g - 1]) : ['HET', 'CHE', 'FMX', 'SEP', 'PSY', 'DOU', 'MXF', 'MXC', 'PEU', 'NUE'];
    el.innerHTML = '<h3>Légende</h3><div class="legend">' + keys.map(k => '<span><i class="sw" style="background:' + C.GROUPS[k].c + '"></i>' + esc(C.GROUPS[k].n) + (vs && vs.forest && present.length ? ' <small class="note">' + Math.round(100 * vs.groups[C.GIDX[k]] / vs.forest) + ' %</small>' : '') + '</span>').join('') + '</div>';
    return;
  }
  el.innerHTML = '<h3>Légende</h3><div class="legend"><span><i class="sw" style="background:' + POT_COL[3] + '"></i>Coin fort</span><span><i class="sw" style="background:' + POT_COL[2] + '"></i>Bon</span>' + (S.showLow ? '<span><i class="sw" style="background:' + POT_COL[1] + '"></i>Possible</span>' : '') + '</div><p class="note" style="margin-top:8px">Potentiel d\'habitat : arbres hôtes × sol estimé × lisière. Il réduit la zone de recherche, il ne garantit pas la présence.</p>';
}

// ---------------------------------------------------------------- fiche d'un point de la carte
let pointMarker = null;
async function onTap(ll) {
  if (!$('#placing').hidden) return;
  const p = M.analyze(ll); S.point = p;
  if (pointMarker) M.map.removeLayer(pointMarker);
  pointMarker = M.L.circleMarker(ll, { radius: 9, color: '#4A2C8F', weight: 3, fillColor: '#FFFFFF', fillOpacity: 0.9, interactive: false }).addTo(M.map);
  renderPoint(); setSheet('open');
  M.communeAt(ll.lat, ll.lng).then(cn => { if (S.point === p && cn) { p.commune = cn; renderPoint(); } });
  try {
    const r = await fetch('https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json?lon=' + ll.lng.toFixed(6) + '&lat=' + ll.lat.toFixed(6) + '&resource=ign_rge_alti_wld&zonly=true');
    const j = await r.json(); const z = j && j.elevations && j.elevations[0]; const v = typeof z === 'object' && z ? z.z : z;
    if (S.point === p) { p.alt = typeof v === 'number' && v > -500 ? Math.round(v) : null; renderPoint(); }
  } catch (e) { if (S.point === p) { p.alt = null; renderPoint(); } }
}
function farGroupText(p) {
  const g = M.far.groupAt(p.lat, p.lng);
  return g ? esc(C.GROUPS[g].n) + ' <span class="note">(vue d\'ensemble, zoomez pour le détail)</span>' : M.map.getZoom() >= M.FAR_Z && M.far.state.idx ? 'hors forêt (vue d\'ensemble)' : 'zoomez pour charger les forêts';
}
function renderPoint() {
  const p = S.point, el = $('#sec-point');
  if (!p) { el.hidden = true; return; }
  el.hidden = false;
  const L0 = C.LITHO[p.litho] || C.LITHO[0];
  let h = '<h3>Ce point</h3><dl class="kv">';
  h += '<dt>Peuplement</dt><dd>' + (p.f ? esc(p.f.label || C.GROUPS[p.f.g].n) + (p.f.ess && !/^(NC|NR)$/i.test(p.f.ess) ? ' <span class="note">(' + esc(p.f.ess) + ')</span>' : '') : (M.map.getZoom() < M.DATA_Z ? farGroupText(p) : 'hors forêt cartographiée')) + '</dd>';
  h += '<dt>Sol estimé</dt><dd>' + esc(L0.n) + (p.rock ? '' : ' <span class="note">— ' + esc(L0.d) + '</span>') + '</dd>';
  if (p.rock) h += '<dt>Sous-sol</dt><dd>' + esc(p.rock.n) + (p.rock.a ? ' <span class="note">(' + esc(p.rock.a) + ')</span>' : '') + '</dd>';
  if (p.commune) h += '<dt>Commune</dt><dd>' + esc(p.commune) + '</dd>';
  if (p.edge != null) h += '<dt>Lisière</dt><dd>' + (p.edge <= p.cell ? 'en lisière' : 'à ≈ ' + p.edge + ' m') + (p.eco ? ' · transition de peuplements' : '') + '</dd>';
  h += '<dt>Altitude</dt><dd>' + (p.alt === undefined ? '…' : p.alt === null ? '—' : p.alt + ' m') + '</dd>';
  if (S.gps && S.gps.fix) h += '<dt>Distance</dt><dd>' + fmtKm(Game.haversine([S.gps.fix.lat, S.gps.fix.lng], [p.lat, p.lng])) + ' de vous</dd>';
  h += '</dl>';
  if (p.pots) {
    const rows = p.pots.slice().sort((a, b) => ((b.season > 0) - (a.season > 0)) || (b.v - a.v));
    h += '<div class="bars" style="margin-top:12px">' + rows.map(r => { const v = Math.round(100 * r.v), lv = C.levelOf(r.v); return '<div class="bar"><span class="t' + (r.season ? '' : ' off') + '">' + esc(r.n) + '</span><i><b style="width:' + v + '%;background:' + (POT_COL[lv] || 'var(--line-2)') + '"></b></i><span class="v">' + v + '</span></div>'; }).join('') + '</div><p class="note" style="margin-top:6px">Potentiel d\'habitat ici (0–100). En gris : hors saison.</p>';
  }
  h += '<div class="actions"><button class="btn primary" data-act="route-point">Itinéraire</button><button class="btn" data-act="find-here">Trouvaille ici</button>' + (S.gid ? '<button class="btn" data-act="treasure-here">Cacher un cèpe d\'or</button>' : '') + (M.map.getZoom() < M.DATA_Z ? '<button class="btn" data-act="zoomhere">Zoomer ici</button>' : '') + '<button class="btn" data-act="closepoint">Fermer</button></div>';
  el.innerHTML = h;
}

// ---------------------------------------------------------------- météo
let wxKey = null, wxTime = 0, wxBusy = false;
async function loadWeather(force) {
  const c = M.map.getCenter(), key = (Math.round(c.lat * 8) / 8).toFixed(3) + ',' + (Math.round(c.lng * 8) / 8).toFixed(3);
  if ((!force && key === wxKey && Date.now() - wxTime < 30 * 60e3) || wxBusy) return;
  wxBusy = true;
  try {
    const [la, lo] = key.split(',');
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + la + '&longitude=' + lo + '&daily=precipitation_sum,temperature_2m_mean,temperature_2m_min,temperature_2m_max&past_days=21&forecast_days=7&timezone=Europe%2FParis');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const sum = C.summarizeWeather(await r.json(), TODAY);
    if (!sum) throw new Error('réponse inattendue');
    S.wx = sum; S.wxErr = null; wxKey = key; wxTime = Date.now();
    S.wxAt = 'le centre de la carte';
    M.communeAt(+la, +lo).then(cn => { if (cn && wxKey === key) { S.wxAt = 'le secteur de ' + cn; renderWx(); } });
  } catch (e) { S.wxErr = e.message || 'erreur'; log('Météo : ' + S.wxErr); }
  finally { wxBusy = false; updatePeek(); renderWx(); }
}

// ---------------------------------------------------------------- GPS : avatar en direct, carte qui suit, sorties
const GPS = { watch: null, native: false, reasons: new Set(), follow: false, centerNext: false, fix: null, heading: null, moving: 0 };
S.gps = GPS;
let meMarker = null, meAcc = null, meKey = '', meAnim = 0, walkT = null;
// Dans l'appli Android, ces usages passent par le suivi natif, qui continue écran éteint (avec une notification)
const BG_REASONS = ['sortie', 'route', 'tresor'];
function gpsStart(reason) {
  GPS.reasons.add(reason);
  if (IN_APP && BG_REASONS.includes(reason)) { nativeTrack(); return true; }
  if (GPS.watch != null || GPS.native) return true;
  return webWatch();
}
function webWatch() {
  if (GPS.watch != null) return true;
  if (!('geolocation' in navigator)) { toast('La localisation n\'est pas disponible sur cet appareil.'); return false; }
  $('#locate').classList.add('wait');
  GPS.watch = navigator.geolocation.watchPosition(onFix, err => {
    $('#locate').classList.remove('wait');
    log('GPS : ' + err.message);
    if (err.code === 1) { store.set('cc.autoloc', false); toast('Localisation refusée. Autorisez-la dans les réglages du navigateur pour ce site.', 6000); gpsStopAll(); }
    else if (err.code === 3 && (GPS.follow || GPS.centerNext)) toast('Le GPS cherche encore votre position…', 3000);
  }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 30000 });
  return true;
}
function gpsStop(reason) { GPS.reasons.delete(reason); if (!GPS.reasons.size) gpsStopAll(); else if (IN_APP) nativeTrack(); }
function gpsStopAll() {
  if (GPS.watch != null) navigator.geolocation.clearWatch(GPS.watch);
  if (GPS.native) { GPS.native = false; nativeReady.then(n => n && n.stopTracking()); }
  GPS.watch = null; GPS.reasons.clear(); $('#locate').classList.remove('wait'); setFollow(false);
  if (meMarker) { M.layers.me.clearLayers(); meMarker = meAcc = null; }
}
// Bascule entre le suivi du navigateur (carte seule) et le suivi natif (sortie, itinéraire, trésor)
async function nativeTrack() {
  const want = [...GPS.reasons].some(r => BG_REASONS.includes(r));
  const n = await nativeReady;
  if (!n) { if (GPS.reasons.size) webWatch(); return; }
  if (want && !GPS.native) {
    GPS.native = true;
    if (GPS.watch != null) { navigator.geolocation.clearWatch(GPS.watch); GPS.watch = null; }
    $('#locate').classList.add('wait');
    const fallback = why => { log('Suivi natif : ' + why); if (!GPS.native) return; GPS.native = false; n.stopTracking(); if (GPS.reasons.size) webWatch(); };
    n.startTracking(onFix, err => {
      $('#locate').classList.remove('wait');
      if (err && err.code === 'NOT_AUTHORIZED') showBanner('Coins à champi n\'a pas accès à ta position. Autorise-la dans les réglages du téléphone (« Toujours » ou « Pendant l\'utilisation »).', 'Réglages', () => { $('#banner').hidden = true; n.openSettings(); });
      fallback((err && (err.code || err.message)) || 'erreur');
    }).then(() => log('Suivi natif démarré (écran éteint possible)')).catch(e => fallback(e.message));
  } else if (!want && GPS.native) {
    GPS.native = false; n.stopTracking().catch(() => {});
    if (GPS.reasons.size) webWatch();
  }
}
// Au lancement : si la localisation est déjà autorisée, le champignon apparaît tout de suite sur la carte
async function autoLocate() {
  if (!('geolocation' in navigator) || store.get('cc.autoloc', null) === false) return;
  // à l'ouverture, la carte vient sur moi dès la première position (sauf si on l'a déjà déplacée)
  // dans l'appli, Android demande lui-même l'autorisation la première fois
  if (IN_APP) { GPS.centerNext = true; gpsStart('carte'); return; }
  let state = 'prompt';
  try { if (navigator.permissions && navigator.permissions.query) state = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch (e) { /* navigateur sans l'API */ }
  if (state === 'granted' || (state === 'prompt' && store.get('cc.autoloc', null) === true)) { GPS.centerNext = true; gpsStart('carte'); }
  else if (state === 'prompt') S.askLoc = true;
}
function askLocation() {
  if (!S.askLoc || S.askedLoc || GPS.watch != null || !S.me) return;
  S.askedLoc = true;
  showBanner('Affiche ton champignon sur la carte et regarde-le avancer quand tu marches.', 'Activer', () => { $('#banner').hidden = true; store.set('cc.autoloc', true); gpsStart('carte'); setFollow(true); GPS.centerNext = true; });
}
function setFollow(on) {
  GPS.follow = !!on;
  const b = $('#locate'); b.classList.toggle('on', GPS.follow); b.setAttribute('aria-pressed', String(GPS.follow));
  b.setAttribute('aria-label', GPS.follow ? 'Arrêter de suivre ma position' : 'Me localiser et suivre ma position');
}
function onFix(pos) {
  const c = pos.coords, now = pos.timestamp || Date.now(), prev = GPS.fix;
  const fx = { lat: c.latitude, lng: c.longitude, acc: c.accuracy || 50, ts: now, heading: c.heading, speed: c.speed };
  // direction de marche : cap du GPS en mouvement, sinon cap entre deux positions assez éloignées
  if (typeof c.heading === 'number' && !isNaN(c.heading) && (c.speed || 0) > 0.6) { GPS.heading = c.heading; GPS.moving = now; }
  else if (prev) { const d = Game.haversine([prev.lat, prev.lng], [fx.lat, fx.lng]); if (d > Math.max(4, fx.acc / 3)) { GPS.heading = Game.bearing([prev.lat, prev.lng], [fx.lat, fx.lng]); GPS.moving = now; } }
  GPS.fix = fx;
  $('#locate').classList.remove('wait');
  renderMe(true);
  if (GPS.centerNext) { GPS.centerNext = false; M.map.setView([fx.lat, fx.lng], Math.max(M.map.getZoom(), 15)); }
  else if (GPS.follow) M.map.panTo([fx.lat, fx.lng], { animate: true, duration: 0.8 });
  if (S.sortie) onSortieFix(fx);
  pushPresence(false);
  checkTreasures();
  if (compassOpen) compassOpen();
  if (treasureLive) treasureLive();
  if (Route.active) routeTick();
  if (pocketOn) renderPocket();
}
function meIcon() {
  const ok = S.me && Av;
  const html = ok ? '<div class="pm me"><i class="dir" hidden></i><img alt="" src="' + avatarImg(S.me.avatar, 120) + '"><span>Moi</span></div>' : '<div class="me-dot"><i class="dir" hidden></i></div>';
  return M.L.divIcon({ className: '', html, iconSize: ok ? [64, 78] : [24, 24], iconAnchor: ok ? [32, 60] : [12, 12] });
}
function renderMe(animate) {
  if (!M || !GPS.fix) return;
  const fx = GPS.fix, ll = M.L.latLng(fx.lat, fx.lng), key = S.me && Av ? JSON.stringify(S.me.avatar || {}) : 'point';
  if (!meMarker) {
    meAcc = M.L.circle(ll, { radius: fx.acc, color: '#1D6FD1', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(M.layers.me);
    meMarker = M.L.marker(ll, { icon: meIcon(), pane: 'people', keyboard: false, interactive: false, zIndexOffset: 1000 }).addTo(M.layers.me);
    meKey = key;
  } else {
    if (key !== meKey) { meMarker.setIcon(meIcon()); meKey = key; }
    meAcc.setRadius(fx.acc);
    if (animate) glide(ll); else { meMarker.setLatLng(ll); meAcc.setLatLng(ll); }
  }
  meState();
}
// Direction (boussole du téléphone si disponible, sinon sens de la marche) et allure « en marche »
function meState() {
  const el = meMarker && meMarker.getElement(); if (!el) return;
  const dir = el.querySelector('.dir'), pm = el.querySelector('.pm'), hd = headingDeg != null ? headingDeg : GPS.heading;
  if (dir) { dir.hidden = hd == null; if (hd != null) dir.style.transform = 'rotate(' + Math.round(hd) + 'deg)'; }
  const walking = Date.now() - GPS.moving < 6000;
  if (pm) pm.classList.toggle('walking', walking);
  clearTimeout(walkT); if (walking) walkT = setTimeout(meState, 6500);
}
// Glissement fluide de l'avatar d'une position à la suivante
function glide(to) {
  const from = meMarker.getLatLng();
  cancelAnimationFrame(meAnim);
  if (from.distanceTo(to) > 400 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { meMarker.setLatLng(to); meAcc.setLatLng(to); return; }
  const t0 = performance.now(), dur = 900;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = k * (2 - k);
    const p = M.L.latLng(from.lat + (to.lat - from.lat) * e, from.lng + (to.lng - from.lng) * e);
    meMarker.setLatLng(p); meAcc.setLatLng(p);
    if (k < 1) meAnim = requestAnimationFrame(step);
  };
  meAnim = requestAnimationFrame(step);
}
// Bouton de localisation : centre la carte sur moi et la fait suivre ; un nouvel appui arrête le suivi
function locateToggle() {
  if (GPS.follow) { setFollow(false); return; }
  store.set('cc.autoloc', true);
  gpsStart('carte');
  setFollow(true);
  if (GPS.fix && Date.now() - GPS.fix.ts < 60000) M.map.setView([GPS.fix.lat, GPS.fix.lng], Math.max(M.map.getZoom(), 15));
  else GPS.centerNext = true;
}
function oneFix(maxAge) {
  if (GPS.fix && Date.now() - GPS.fix.ts < (maxAge || 120000)) return Promise.resolve(GPS.fix);
  return new Promise(resolve => {
    if (!('geolocation' in navigator)) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(pos => { onFix(pos); resolve(GPS.fix); }, () => resolve(null), { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  });
}

// ---------------------------------------------------------------- placement manuel sur la carte
let placeResolve = null;
function pickOnMap(start) {
  return new Promise(resolve => {
    $('#modal').hidden = true;
    if (S.tab !== 'carte') openTab('carte');
    if (start) M.map.setView([start.lat, start.lng], Math.max(M.map.getZoom(), 16));
    $('#placing').hidden = false; placeResolve = resolve;
  });
}
function endPlacing(ok) {
  $('#placing').hidden = true;
  const r = placeResolve; placeResolve = null;
  const c = M.map.getCenter();
  $('#modal').hidden = false;
  if (r) r(ok ? { lat: c.lat, lng: c.lng, acc: 10, src: 'carte' } : null);
}

// ---------------------------------------------------------------- nouvelle trouvaille
function inSeasonCatalog() {
  const w = s => s.core ? C.seasonOf(C.SPECIES.find(x => x.id === s.core), MONTH) : (s.m && s.m[MONTH]) || 0;
  return Game.CATALOG.filter(s => s.id !== 'autre').map(s => ({ s, w: w(s) })).sort((a, b) => b.w - a.w).map(x => x.s).concat([Game.SPECIES_BY_ID.autre]);
}
function openNewFind(preset) {
  if (!S.sync) { toast('Connexion au jeu en cours, réessayez dans un instant.'); return; }
  if (!S.me) { startOnboarding(); return; }
  const d = { photo: null, species: S.sp !== 'all' ? (Game.CATALOG.find(x => x.core === S.sp) || {}).id || null : null, qty: 1, note: '', vis: S.gid ? S.settings.vis : 'prive', pos: preset ? { lat: preset.lat, lng: preset.lng, acc: 10, src: 'carte' } : null };
  const card = openModal(modalHead('Nouvelle trouvaille') +
    '<button class="photo-drop" data-act="nf-cam" id="nf-photo" aria-label="Prendre une photo"><span>Prendre la photo du coin</span></button>' +
    '<div class="photo-row"><button class="btn small" data-act="nf-cam">Appareil photo</button><button class="btn small" data-act="nf-gal">Galerie</button></div>' +
    '<div class="editor-sec" style="margin-top:12px"><h3>Espèce</h3><div class="sp-grid" id="nf-sp">' + inSeasonCatalog().map(s => '<button data-sp-id="' + s.id + '" aria-pressed="' + (d.species === s.id) + '"><img alt="" src="' + speciesImg(s.id, 72) + '">' + esc(s.n) + '</button>').join('') + '</div></div>' +
    '<div class="editor-sec"><h3>Quantité</h3><div class="opts" id="nf-qty">' + [1, 2, 3].map(q => '<button class="opt-chip" data-q="' + q + '" aria-pressed="' + (d.qty === q) + '">' + Game.QTY[q].n + '</button>').join('') + '</div></div>' +
    '<div class="editor-sec"><h3>Note</h3><textarea class="input" id="nf-note" maxlength="300" placeholder="Sous les hêtres, au bord du chemin forestier…"></textarea></div>' +
    '<div class="editor-sec"><h3>Qui peut voir ce coin ?</h3><div class="opts" id="nf-vis">' + Object.entries(Game.VISIBILITY).map(([k, v]) => '<button class="opt-chip" data-v="' + k + '" aria-pressed="' + (d.vis === k) + '"' + (!S.gid && k !== 'prive' ? ' disabled title="Rejoignez un groupe pour partager"' : '') + '>' + v + '</button>').join('') + '</div>' + (!S.gid ? '<p class="note" style="margin:6px 0 0">Rejoignez un groupe pour partager vos coins.</p>' : '<p class="note" style="margin:6px 0 0">Floutée : vos amis voient une zone d\'environ 300 m, pas le point exact.</p>') + '</div>' +
    '<div class="editor-sec"><h3>Position</h3><div class="row"><span class="grow" id="nf-pos">Recherche de votre position…</span><button class="btn small" data-act="nf-map">Sur la carte</button></div></div>' +
    '<p class="note" id="nf-err" style="color:var(--danger)" hidden></p>' +
    '<div class="actions"><button class="btn primary block" data-act="nf-save">Enregistrer la trouvaille</button></div>');
  const posEl = card.querySelector('#nf-pos');
  const showPos = () => {
    posEl.textContent = d.pos ? (d.pos.src === 'gps' ? 'Ici, à ± ' + Math.round(d.pos.acc) + ' m' : d.pos.src === 'photo' ? 'Position enregistrée dans la photo' : 'Point choisi sur la carte') + (M.communeCached(d.pos.lat, d.pos.lng) ? ' · ' + M.communeCached(d.pos.lat, d.pos.lng) : '') : 'Position inconnue : placez le point sur la carte.';
    if (d.pos && !M.communeCached(d.pos.lat, d.pos.lng)) { const at = d.pos; M.communeAt(at.lat, at.lng).then(cn => { if (cn && d.pos === at) showPos(); }); }
  };
  if (d.pos) showPos();
  else oneFix(120000).then(fx => { if (!d.pos && fx) d.pos = { lat: fx.lat, lng: fx.lng, acc: fx.acc, src: 'gps' }; showPos(); });
  const err = m => { const e = card.querySelector('#nf-err'); e.textContent = m; e.hidden = !m; };
  const takePhoto = async capture => {
    const file = await pickImage({ capture });
    if (!file) return;
    const box = card.querySelector('#nf-photo'); box.innerHTML = '<span>Préparation de la photo…</span>';
    try {
      d.photo = await processPhoto(file);
      box.innerHTML = '<img alt="Photo de la trouvaille" src="' + d.photo.thumb + '">';
      const im = box.querySelector('img'); const full = new Image(); full.onload = () => { im.src = d.photo.full; }; full.src = d.photo.full;
      if (d.photo.gps && (!d.pos || d.pos.src !== 'gps' || !capture)) { d.pos = { lat: d.photo.gps.lat, lng: d.photo.gps.lng, acc: 15, src: 'photo' }; showPos(); }
    } catch (e) { box.innerHTML = '<span>Photo illisible, réessayez</span>'; log('Photo : ' + e.message); }
  };
  card.addEventListener('click', async e => {
    const sp = e.target.closest('[data-sp-id]'); if (sp) { d.species = sp.dataset.spId; card.querySelectorAll('[data-sp-id]').forEach(b => b.setAttribute('aria-pressed', String(b === sp))); err(''); return; }
    const q = e.target.closest('[data-q]'); if (q) { d.qty = +q.dataset.q; card.querySelectorAll('[data-q]').forEach(b => b.setAttribute('aria-pressed', String(b === q))); return; }
    const v = e.target.closest('#nf-vis [data-v]'); if (v && !v.disabled) { d.vis = v.dataset.v; card.querySelectorAll('#nf-vis [data-v]').forEach(b => b.setAttribute('aria-pressed', String(b === v))); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'nf-cam') takePhoto(true);
    if (a.dataset.act === 'nf-gal') takePhoto(false);
    if (a.dataset.act === 'nf-map') { const r = await pickOnMap(d.pos); if (r) { d.pos = r; showPos(); } }
    if (a.dataset.act === 'nf-save') {
      if (!d.species) { err('Choisissez l\'espèce (ou « Autre, à identifier »).'); card.querySelector('#nf-sp').scrollIntoView({ block: 'center' }); return; }
      if (!d.pos) { err('Placez la trouvaille sur la carte.'); return; }
      d.note = card.querySelector('#nf-note').value.trim();
      a.disabled = true; a.textContent = 'Enregistrement…';
      saveFind(d);
    }
  });
}
async function saveFind(d) {
  const id = Game.newId('f'), ts = Date.now();
  const commune = M.communeCached(d.pos.lat, d.pos.lng) || await M.communeAt(d.pos.lat, d.pos.lng, 1500);
  const find = { id, species: d.species, qty: d.qty, note: d.note, ts, lat: +d.pos.lat.toFixed(6), lng: +d.pos.lng.toFixed(6), acc: Math.round(d.pos.acc || 0), vis: S.gid ? d.vis : 'prive', commune, thumb: d.photo ? d.photo.thumb : null, hasPhoto: !!d.photo, sortieId: S.sortie ? S.sortie.id : null };
  let pub = null;
  if (S.gid && find.vis !== 'prive') {
    const [bl, bg] = find.vis === 'flou' ? Game.blur(find.lat, find.lng, 300) : [find.lat, find.lng];
    pub = { id, species: find.species, qty: find.qty, note: find.note, ts, vis: find.vis, commune, thumb: find.thumb, hasPhoto: find.hasPhoto, name: S.me.name, avatar: S.me.avatar, lat: +bl.toFixed(6), lng: +bg.toFixed(6), blurR: find.vis === 'flou' ? 300 : 0 };
  }
  const first = find.species !== 'autre' && !S.myFinds.some(f => f.species === find.species);
  const pts = Game.findPoints(find, first);
  S.sync.saveFind(find, d.photo ? d.photo.full : null, S.gid, pub).catch(e => toast('Trouvaille gardée sur le téléphone, synchronisation impossible : ' + (e.message || e), 6000));
  if (S.sortie) { S.sortie.finds.push({ id, species: find.species, qty: find.qty, vis: find.vis }); saveSortieState(); updateSortieBar(); }
  if (S.gid && pub && find.vis === 'groupe') S.sync.sendEvent(S.gid, { type: 'find', name: S.me.name, species: find.species, lat: pub.lat, lng: pub.lng, fid: id }).catch(() => {});
  celebrate(pts, first ? 'Nouvelle espèce au Mycodex : ' + (Game.SPECIES_BY_ID[find.species] || {}).n : (Game.SPECIES_BY_ID[find.species] || {}).n + ' enregistré' + (find.vis === 'prive' ? ' (coin secret)' : ''));
}
function celebrate(pts, line) {
  const card = openModal('<div class="celebrate"><canvas id="cel-stage"></canvas><div class="pts">+' + pts + ' points</div><p style="font-size:16px;margin:10px 0 0">' + esc(line || '') + '</p></div><div class="actions"><button class="btn primary block" data-act="modal-close">Continuer</button></div>');
  const st = stage(card.querySelector('#cel-stage'), S.me && S.me.avatar, { base: false, turn: false }, 'modal');
  if (st) setTimeout(() => st.play('cheer'), 120);
  vibrate([40, 30, 80]);
}
function celebrateLevel(prof) {
  const card = openModal('<div class="celebrate"><canvas id="cel-stage"></canvas><div class="pts">Niveau ' + prof.level + '</div><p style="font-size:18px;margin:8px 0 0;font-family:var(--font-display);font-weight:700">' + esc(prof.name) + '</p></div><div class="actions"><button class="btn primary block" data-act="modal-close">Bravo !</button></div>');
  const st = stage(card.querySelector('#cel-stage'), S.me && S.me.avatar, { base: true, turn: false }, 'modal');
  if (st) setTimeout(() => st.play('cheer'), 120);
}

// ---------------------------------------------------------------- marqueurs des trouvailles
function renderFinds() {
  if (!M) return;
  const lay = M.layers.finds; lay.clearLayers();
  const L = M.L;
  const mine = new Set(S.myFinds.map(f => f.id));
  const add = (f, own) => {
    const col = own ? '#4A2C8F' : '#1F5C3A';
    const img = f.thumb ? '<img alt="" src="' + f.thumb + '">' : '<img alt="" src="' + speciesImg(f.species, 64) + '">';
    const html = '<div class="fm' + (f.thumb ? '' : ' noimg') + (f.blurR ? ' blur' : '') + '" style="--c:' + col + '">' + img + (own && f.vis === 'prive' ? '<span class="lock">' + ICON.lock + '</span>' : '') + '</div>';
    if (f.blurR && !own) L.circle([f.lat, f.lng], { radius: f.blurR, color: col, weight: 2, dashArray: '5 6', fillOpacity: 0.06, interactive: false }).addTo(lay);
    const m = L.marker([f.lat, f.lng], { icon: L.divIcon({ className: '', html, iconSize: [46, 46], iconAnchor: [23, 23] }), title: (Game.SPECIES_BY_ID[f.species] || {}).n || '' });
    m.on('click', () => openFind(f, own)); m.addTo(lay);
  };
  S.myFinds.forEach(f => add(f, true));
  S.groupFinds.filter(f => f.uid !== S.uid && !mine.has(f.id)).forEach(f => add(f, false));
}
async function openFind(f, own) {
  const sp = Game.SPECIES_BY_ID[f.species] || Game.SPECIES_BY_ID.autre;
  const gf = !own ? f : S.groupFinds.find(x => x.id === f.id);
  const likes = gf && gf.likedBy ? gf.likedBy.length : 0, liked = gf && gf.likedBy && gf.likedBy.includes(S.uid);
  const who = own ? 'vous' : (f.name || 'un ami');
  const card = openModal(modalHead(sp.n) +
    (f.hasPhoto || f.thumb ? '<img class="big-photo" id="fd-photo" alt="Photo de la trouvaille" src="' + (f.thumb || '') + '">' : '<img alt="" src="' + speciesImg(f.species, 160) + '" style="width:140px;display:block;margin:0 auto">') +
    '<div class="latin" style="margin-top:10px">' + esc(sp.lat) + '</div>' +
    '<dl class="kv"><dt>Trouvé par</dt><dd>' + esc(who) + '</dd><dt>Quand</dt><dd>' + esc(dateFr(f.ts)) + '</dd><dt>Quantité</dt><dd>' + esc((Game.QTY[f.qty] || Game.QTY[1]).n) + '</dd>' + (f.commune ? '<dt>Commune</dt><dd>' + esc(f.commune) + '</dd>' : '') + '<dt>Visible par</dt><dd>' + esc(own ? Game.VISIBILITY[f.vis] || 'Privée' : f.blurR ? 'le groupe (position floutée ≈ 300 m)' : 'le groupe') + '</dd>' + (S.gid && gf ? '<dt>Bravos</dt><dd>' + likes + '</dd>' : '') + '</dl>' +
    (f.note ? '<p style="margin:10px 0 0">« ' + esc(f.note) + ' »</p>' : '') +
    '<div class="actions">' + (!f.blurR || own ? '<button class="btn primary" data-act="route-find" data-id="' + esc(f.id) + '" data-own="' + (own ? 1 : 0) + '">Itinéraire</button>' : '') +
    (!own && S.gid ? '<button class="btn" data-act="fd-like"' + (liked ? ' disabled' : '') + '>' + (liked ? 'Bravo envoyé' : 'Bravo !') + '</button>' : '') +
    '<button class="btn" data-act="fd-center">Voir sur la carte</button>' +
    (own ? '<button class="btn danger" data-act="fd-del">Supprimer</button>' : '') + '</div>');
  card.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'fd-like') { S.sync.like(S.gid, f.id).catch(() => {}); a.textContent = 'Bravo envoyé'; a.disabled = true; vibrate(30); }
    if (a.dataset.act === 'fd-center') { closeModal(); openTab('carte'); M.map.setView([f.lat, f.lng], Math.max(M.map.getZoom(), 16)); }
    if (a.dataset.act === 'fd-del') {
      if (a.dataset.confirm) { const mf = S.myFinds.find(x => x.id === f.id) || f; S.sync.deleteFind(mf).catch(() => {}); closeModal(); toast('Trouvaille supprimée'); }
      else { a.dataset.confirm = '1'; a.textContent = 'Confirmer la suppression'; }
    }
  });
  if (f.hasPhoto) {
    try { const mf = own ? (S.myFinds.find(x => x.id === f.id) || f) : Object.assign({ photoAt: 'group', gid: S.gid }, f); const data = await S.sync.getPhoto(mf, S.gid); const im = card.querySelector('#fd-photo'); if (data && im) im.src = data; }
    catch (e) { log('Photo : ' + e.message); }
  }
}

// ---------------------------------------------------------------- amis en direct
function renderFriends() {
  if (!M) return;
  const lay = M.layers.friends; lay.clearLayers();
  const L = M.L, now = Date.now();
  for (const p of S.presence) {
    if (p.id === S.uid || !p.sharing || !p.lat || now - p.ts > 6 * 3600e3) continue;
    const mem = S.members.find(m => m.id === p.id) || {};
    const name = mem.name || p.name || 'Ami';
    const live = now - p.ts < 120e3, stale = now - p.ts > 600e3;
    const html = '<div class="pm' + (live ? ' live bounce' : '') + (stale ? ' stale' : '') + '"><img alt="" src="' + avatarImg(mem.avatar || p.avatar, 120) + '"><span>' + esc(name) + '</span></div>';
    const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html, iconSize: [64, 78], iconAnchor: [32, 60] }), pane: 'people', title: name });
    m.on('click', () => openFriend(p, mem));
    m.addTo(lay);
  }
}
function openFriend(p, mem) {
  const lvl = Game.levelOf(mem.xp || 0);
  const d = GPS.fix ? Game.haversine([GPS.fix.lat, GPS.fix.lng], [p.lat, p.lng]) : null;
  const card = openModal(modalHead(mem.name || p.name || 'Ami') + '<canvas class="editor-stage" id="fr-stage" style="height:200px"></canvas>' +
    '<dl class="kv"><dt>Niveau</dt><dd>' + lvl.level + ' · ' + esc(lvl.name) + '</dd><dt>Position</dt><dd>' + esc(ago(p.ts)) + (p.acc ? ' (± ' + Math.round(p.acc) + ' m)' : '') + '</dd>' + (d != null ? '<dt>Distance</dt><dd>' + fmtKm(d) + ' de vous</dd>' : '') + '</dl>' +
    '<div class="actions"><button class="btn primary" data-act="route-friend" data-uid="' + esc(p.id) + '">Le rejoindre</button><button class="btn" data-act="fr-center">Centrer</button></div>');
  stage(card.querySelector('#fr-stage'), mem.avatar || p.avatar, { base: true }, 'modal');
  card.querySelector('[data-act="fr-center"]').onclick = () => { closeModal(); M.map.setView([p.lat, p.lng], Math.max(M.map.getZoom(), 16)); };
}

// ---------------------------------------------------------------- alertes du groupe
const seenEvents = new Set();
function onEvents(list) {
  S.events = list;
  const lay = M.layers.events; lay.clearLayers();
  const L = M.L, now = Date.now();
  for (const ev of list) {
    const fresh = now - ev.ts < (ev.type === 'sos' ? 2 * 3600e3 : 3600e3);
    if (fresh && ev.lat && ev.type !== 'find' && ev.type !== 'treasure') {
      const icon = L.divIcon({ className: '', html: '<div class="em ' + ev.type + '">' + (ev.type === 'sos' ? ICON.sos : ev.type === 'rally' ? ICON.flag : ICON.eye) + '</div>', iconSize: [40, 40], iconAnchor: [20, 20] });
      L.marker([ev.lat, ev.lng], { icon, pane: 'people' }).on('click', () => openEvent(ev)).addTo(lay);
    }
    if (!seenEvents.has(ev.id)) {
      seenEvents.add(ev.id);
      if (ev.uid !== S.uid && ev.ts > APP_START - 60e3) notifyEvent(ev);
    }
  }
  renderPanelIfOpen('groupe');
}
const evText = ev => ev.type === 'sos' ? 'SOS de ' + ev.name : ev.type === 'rally' ? ev.name + ' propose de se regrouper' : ev.type === 'look' ? ev.name + ' : « ' + (ev.msg || 'Venez voir !') + ' »' : ev.type === 'find' ? ev.name + ' a trouvé : ' + ((Game.SPECIES_BY_ID[ev.species] || {}).n || 'un champignon') : ev.type === 'treasure' ? ev.name + ' a trouvé le cèpe d\'or !' : ev.type === 'hidden' ? ev.name + ' a caché un cèpe d\'or' : ev.name + ' : ' + (ev.msg || '');
function notifyEvent(ev) {
  if (NativeApp && document.hidden) nativeNotify(ev);
  if (ev.type === 'sos') { vibrate([300, 120, 300, 120, 600]); openEvent(ev); return; }
  toast(evText(ev), 5000, ev.type === 'look' || ev.type === 'rally' ? '' : '');
  vibrate(ev.type === 'look' || ev.type === 'rally' ? [80, 60, 80] : 40);
}
function openEvent(ev) {
  const d = GPS.fix && ev.lat ? Game.haversine([GPS.fix.lat, GPS.fix.lng], [ev.lat, ev.lng]) : null;
  openModal(modalHead(ev.type === 'sos' ? 'SOS' : ev.type === 'rally' ? 'Regroupement' : 'Venez voir !') + '<p style="font-size:16px">' + esc(evText(ev)) + '</p><dl class="kv"><dt>Envoyé</dt><dd>' + esc(ago(ev.ts)) + '</dd>' + (d != null ? '<dt>Distance</dt><dd>' + fmtKm(d) + '</dd>' : '') + '</dl>' +
    (ev.lat ? '<div class="actions"><button class="btn ' + (ev.type === 'sos' ? 'gold' : 'primary') + '" data-act="route-event" data-lat="' + ev.lat + '" data-lng="' + ev.lng + '" data-name="' + esc(ev.type === 'sos' ? 'le SOS de ' + ev.name : ev.name) + '">Y aller</button><button class="btn" data-act="ev-center" data-lat="' + ev.lat + '" data-lng="' + ev.lng + '">Voir sur la carte</button></div>' : '') +
    (ev.type === 'sos' ? '<p class="note" style="margin-top:10px">En cas d\'urgence réelle, appelez le 112.</p>' : ''));
}
async function openAlertMenu() {
  if (!S.gid) { toast('Rejoignez un groupe pour envoyer des alertes.'); return; }
  const card = openModal(modalHead('Prévenir le groupe') +
    '<div class="field"><label for="al-msg">Message (facultatif)</label><input class="input" id="al-msg" maxlength="80" placeholder="Coin à girolles, venez !"></div>' +
    '<div class="actions" style="flex-direction:column"><button class="btn primary block" data-act="al-look">Venez voir !</button><button class="btn block" data-act="al-rally">Regroupement ici</button><button class="btn danger block" data-act="al-sos">SOS</button></div><p class="note" style="margin-top:10px">Votre position actuelle est jointe à l\'alerte.</p>');
  card.addEventListener('click', async e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    const type = a.dataset.act === 'al-look' ? 'look' : a.dataset.act === 'al-rally' ? 'rally' : a.dataset.act === 'al-sos' ? 'sos' : null;
    if (!type) return;
    if (type === 'sos' && !a.dataset.confirm) { a.dataset.confirm = '1'; a.textContent = 'Envoyer le SOS à tout le groupe'; return; }
    const fx = await oneFix(60000);
    if (!fx) { toast('Position introuvable : activez la localisation.'); return; }
    S.sync.sendEvent(S.gid, { type, name: S.me.name, msg: card.querySelector('#al-msg').value.trim(), lat: +fx.lat.toFixed(6), lng: +fx.lng.toFixed(6) }).catch(() => {});
    closeModal(); toast(type === 'sos' ? 'SOS envoyé au groupe' : 'Alerte envoyée'); vibrate(50);
  });
}

// ---------------------------------------------------------------- cèpes d'or
const activeTreasure = t => !t.foundBy && (!t.expires || t.expires > Date.now());
function renderTreasures() {
  if (!M) return;
  const lay = M.layers.treasures; lay.clearLayers();
  const L = M.L;
  for (const t of S.treasures) {
    if (t.type !== 'treasure') continue;
    if (activeTreasure(t)) {
      L.circle([t.zoneLat, t.zoneLng], { radius: t.zoneR || 250, color: '#C8921A', weight: 3, dashArray: '8 7', fillColor: '#E6B54A', fillOpacity: 0.1, interactive: false }).addTo(lay);
      const mineT = t.createdBy === S.uid;
      L.marker(mineT ? [t.lat, t.lng] : [t.zoneLat, t.zoneLng], { icon: L.divIcon({ className: '', html: '<div class="tz">' + (mineT ? '★' : '?') + '</div>', iconSize: [38, 38], iconAnchor: [19, 19] }), pane: 'people' }).on('click', () => openTreasure(t)).addTo(lay);
    } else if (t.foundBy && Date.now() - (t.foundAt || 0) < 3 * 86400e3) {
      L.marker([t.lat, t.lng], { icon: L.divIcon({ className: '', html: '<div class="tz found">★</div>', iconSize: [38, 38], iconAnchor: [19, 19] }) }).on('click', () => openTreasure(t)).addTo(lay);
    }
  }
}
function treasureDist(t) { return GPS.fix ? Game.haversine([GPS.fix.lat, GPS.fix.lng], [t.lat, t.lng]) : null; }
function hotCold(t) {
  const d = treasureDist(t); if (d == null) return '<p class="note">Activez la localisation pour savoir si vous chauffez.</p>';
  const k = Math.max(0, Math.min(1, 1 - (Math.log10(Math.max(10, d)) - 1) / 2.3));
  const word = d < 50 ? 'Brûlant !' : d < 150 ? 'Très chaud' : d < 400 ? 'Chaud' : d < 1000 ? 'Tiède' : 'Froid';
  return '<div class="hotcold"><b style="min-width:6.5em">' + word + '</b><div class="meter"><i style="left:' + Math.round(k * 100) + '%"></i></div></div>';
}
function openTreasure(t) {
  const mineT = t.createdBy === S.uid;
  const hider = (S.members.find(m => m.id === t.createdBy) || {}).name || t.name || 'Un ami';
  openModal(modalHead('Cèpe d\'or') + (t.foundBy ? '<p style="font-size:16px">Trouvé par <b>' + esc(t.foundByName || 'un ami') + '</b> ' + esc(ago(t.foundAt)) + '.</p>' :
    '<p style="font-size:16px">Caché par <b>' + esc(hider) + '</b>' + (t.expires ? ', jusqu\'au ' + esc(new Date(t.expires).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })) : '') + '.</p>' +
    (t.hint ? '<div class="warnbox"><b>Indice :</b> ' + esc(t.hint) + '</div>' : '') +
    '<p class="note" style="margin-top:10px">Il se trouve quelque part dans le cercle doré. Approchez à moins de 25 m pour le ramasser : +' + Game.TREASURE_FOUND + ' points.</p>' + (mineT ? '<p class="note">C\'est votre trésor : vous voyez son emplacement exact (★).</p><div class="actions"><button class="btn danger" data-act="tr-del" data-id="' + esc(t.id) + '">Retirer ce trésor</button></div>' : '<div id="tr-hc">' + hotCold(t) + '</div><div class="actions"><button class="btn gold" data-act="route-zone" data-id="' + esc(t.id) + '">Aller vers la zone</button></div>')),
    () => { treasureLive = null; gpsStop('tresor'); });
  // Chaud ou froid en direct pendant qu'on cherche
  if (!t.foundBy && !mineT && activeTreasure(t)) {
    gpsStart('tresor');
    treasureLive = () => { const el = document.getElementById('tr-hc'); if (el) el.innerHTML = hotCold(t); };
  }
}
let treasureLive = null;
function openHideTreasure(at) {
  if (!S.gid) { toast('Rejoignez un groupe pour cacher un cèpe d\'or.'); return; }
  const d = { pos: at ? { lat: at.lat, lng: at.lng, src: 'carte' } : null, days: 3 };
  const card = openModal(modalHead('Cacher un cèpe d\'or') +
    '<p>Vos amis verront une zone d\'environ 250 m autour du trésor. Le premier qui s\'en approche à moins de 25 m gagne ' + Game.TREASURE_FOUND + ' points ; vous en gagnez ' + Game.TREASURE_HIDDEN + '.</p>' +
    '<div class="field"><label for="tr-hint">Indice</label><input class="input" id="tr-hint" maxlength="120" placeholder="Au pied du grand hêtre, près de la mare"></div>' +
    '<div class="editor-sec"><h3>Durée</h3><div class="opts" id="tr-days">' + [[1, '24 heures'], [3, '3 jours'], [7, 'Une semaine']].map(([v, n]) => '<button class="opt-chip" data-days="' + v + '" aria-pressed="' + (d.days === v) + '">' + n + '</button>').join('') + '</div></div>' +
    '<div class="editor-sec"><h3>Emplacement</h3><div class="row"><span class="grow" id="tr-pos">Recherche de votre position…</span><button class="btn small" data-act="tr-map">Sur la carte</button></div></div>' +
    '<p class="note" id="tr-err" style="color:var(--danger)" hidden></p><div class="actions"><button class="btn gold block" data-act="tr-save">Cacher le trésor</button></div>');
  const posEl = card.querySelector('#tr-pos');
  const show = () => { posEl.textContent = d.pos ? (d.pos.src === 'gps' ? 'Ici (± ' + Math.round(d.pos.acc) + ' m)' : 'Point choisi sur la carte') : 'Position inconnue : choisissez sur la carte.'; };
  if (d.pos) show(); else oneFix(60000).then(fx => { if (!d.pos && fx) d.pos = { lat: fx.lat, lng: fx.lng, acc: fx.acc, src: 'gps' }; show(); });
  card.addEventListener('click', async e => {
    const dy = e.target.closest('[data-days]'); if (dy) { d.days = +dy.dataset.days; card.querySelectorAll('[data-days]').forEach(b => b.setAttribute('aria-pressed', String(b === dy))); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'tr-map') { const r = await pickOnMap(d.pos); if (r) { d.pos = r; show(); } }
    if (a.dataset.act === 'tr-save') {
      if (!d.pos) { const er = card.querySelector('#tr-err'); er.textContent = 'Choisissez l\'emplacement.'; er.hidden = false; return; }
      const id = Game.newId('t'), R0 = 250, off = Game.blur(d.pos.lat, d.pos.lng, R0 * 0.75);
      const t = { id, lat: +d.pos.lat.toFixed(6), lng: +d.pos.lng.toFixed(6), zoneLat: +off[0].toFixed(6), zoneLng: +off[1].toFixed(6), zoneR: R0, hint: card.querySelector('#tr-hint').value.trim(), expires: Date.now() + d.days * 86400e3, name: S.me.name };
      S.sync.hideTreasure(S.gid, t).catch(() => {});
      S.sync.saveMe({ treasuresHidden: [...((S.me && S.me.treasuresHidden) || []), { gid: S.gid, id, ts: Date.now() }] }).catch(() => {});
      S.sync.sendEvent(S.gid, { type: 'hidden', name: S.me.name, msg: t.hint }).catch(() => {});
      closeModal(); toast('Cèpe d\'or caché ! Prévenez vos amis.');
    }
  });
}
const claiming = new Set();
function checkTreasures() {
  if (!S.gid || !GPS.fix || GPS.fix.acc > 60) return;
  for (const t of S.treasures) {
    if (t.type !== 'treasure' || !activeTreasure(t) || t.createdBy === S.uid || claiming.has(t.id)) continue;
    if (Game.haversine([GPS.fix.lat, GPS.fix.lng], [t.lat, t.lng]) <= 25 + Math.min(20, GPS.fix.acc / 2)) {
      claiming.add(t.id);
      S.sync.claimTreasure(S.gid, t.id, S.me && S.me.name).then(() => {
        S.sync.saveMe({ treasuresFound: [...((S.me && S.me.treasuresFound) || []), { gid: S.gid, id: t.id, ts: Date.now() }] }).catch(() => {});
        S.sync.sendEvent(S.gid, { type: 'treasure', name: S.me.name }).catch(() => {});
        celebrate(Game.TREASURE_FOUND, 'Vous avez trouvé le cèpe d\'or !');
      }).catch(e => { toast(e.code === 'taken' ? e.message : 'Trésor : ' + (e.message || e)); });
    }
  }
}

// ---------------------------------------------------------------- sorties
let sortieTimer = null, wakeLock = null, lastPresence = { ts: 0, lat: 0, lng: 0 }, sortieLine = null, carMarker = null;
function openStartSortie() {
  if (!S.sync) { toast('Connexion au jeu en cours…'); return; }
  if (S.sortie) { openEndSortie(); return; }
  const card = openModal(modalHead('Démarrer une sortie') +
    '<div class="toggle-row"><span>Ma voiture est garée ici<small>Pour retrouver le chemin du parking</small></span><input type="checkbox" class="switch" id="ss-car" checked></div>' +
    '<div class="toggle-row"><span>Partager ma position avec le groupe<small>' + (S.gid ? 'Visible par les membres pendant la sortie seulement' : 'Rejoignez un groupe pour partager') + '</small></span><input type="checkbox" class="switch" id="ss-share"' + (S.gid && S.settings.share ? ' checked' : '') + (S.gid ? '' : ' disabled') + '></div>' +
    (IN_APP ? '<p class="note" style="margin:8px 0 4px">Tu peux éteindre l\'écran et ranger le téléphone : ta trace et ta position continuent (notification « Coins à champi »).</p><input type="checkbox" id="ss-wake" hidden>' : '<div class="toggle-row"><span>Garder l\'écran allumé<small>Le partage s\'arrête si l\'appli passe en arrière-plan</small></span><input type="checkbox" class="switch" id="ss-wake"' + (S.settings.wake ? ' checked' : '') + '></div>') +
    '<div class="actions"><button class="btn forest block" data-act="ss-go">C\'est parti !</button></div>');
  card.querySelector('[data-act="ss-go"]').onclick = () => {
    const car = card.querySelector('#ss-car').checked, share = card.querySelector('#ss-share').checked, wake = card.querySelector('#ss-wake').checked;
    S.settings.share = share || !S.gid ? share : S.settings.share; S.settings.wake = wake; store.set('cc.settings', S.settings);
    S.sortie = { id: Game.newId('s'), start: Date.now(), track: [], dist: 0, car: null, wantCar: car, share: share && !!S.gid, wake, finds: [], xp0: S.prof ? S.prof.xp : 0 };
    saveSortieState(); closeModal(); resumeSortie(); toast('Bonne sortie ! Votre trace s\'enregistre.');
  };
}
function resumeSortie() {
  const s = S.sortie; if (!s) return;
  if (!s.finds) s.finds = [];
  gpsStart('sortie');
  $('#sortie-bar').hidden = false;
  $('#sb-live').hidden = !s.share;
  clearInterval(sortieTimer); sortieTimer = setInterval(updateSortieBar, 1000); updateSortieBar();
  if (s.wake) requestWake();
  drawSortie();
  setTimeout(() => M.map.invalidateSize(), 50);
}
function saveSortieState() { if (S.sortie) store.set('cc.sortie', S.sortie); }
function updateSortieBar() {
  const s = S.sortie; if (!s) return;
  const sec = Math.floor((Date.now() - s.start) / 1000);
  $('#sb-time').textContent = Math.floor(sec / 3600) + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
  $('#sb-dist').textContent = fmtKm(s.dist);
  $('#sb-finds').textContent = s.finds.length + ' trouvaille' + (s.finds.length > 1 ? 's' : '');
}
// Écran gardé allumé (sortie, mode poche) ; wakeFail : le navigateur ne sait pas le faire, il faut régler la mise en veille
let wakeFail = false;
async function requestWake() {
  if (IN_APP) return;
  if (!('wakeLock' in navigator)) { wakeFail = true; return; }
  try { if (!wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeFail = false; wakeLock.addEventListener('release', () => { wakeLock = null; }); } }
  catch (e) { wakeFail = true; log('Écran allumé : ' + e.message); }
  if (pocketOn) renderPocket();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if ((S.sortie && S.sortie.wake) || pocketOn) requestWake(); pushPresence(true); renderFriends(); }
});
function onSortieFix(fx) {
  const s = S.sortie; if (!s) return;
  if (s.wantCar && !s.car && fx.acc <= 80) { s.car = { lat: +fx.lat.toFixed(6), lng: +fx.lng.toFixed(6) }; drawSortie(); }
  if (fx.acc <= 40) {
    const last = s.track[s.track.length - 1];
    const d = last ? Game.haversine([last[0], last[1]], [fx.lat, fx.lng]) : Infinity;
    if (!last || d >= 8) {
      if (last && d < 250) s.dist += d;
      s.track.push([+fx.lat.toFixed(6), +fx.lng.toFixed(6), Math.round((fx.ts - s.start) / 1000)]);
      if (s.track.length === 1) M.communeAt(fx.lat, fx.lng);
      drawSortie();
      if (s.track.length % 5 === 0) saveSortieState();
      if (fogOn()) renderTracksAndFog();
    }
  }
}
const sharingNow = () => !!(S.gid && S.me && (S.settings.liveShare || (S.sortie && S.sortie.share)));
function pushPresence(force) {
  const fx = GPS.fix;
  if (!sharingNow() || !fx) return;
  const moved = Game.haversine([lastPresence.lat, lastPresence.lng], [fx.lat, fx.lng]);
  if (!force && Date.now() - lastPresence.ts < 15000 && moved < 25) return;
  if (!force && Date.now() - lastPresence.ts < 5000) return;
  lastPresence = { ts: Date.now(), lat: fx.lat, lng: fx.lng };
  const doc = { lat: +fx.lat.toFixed(6), lng: +fx.lng.toFixed(6), acc: Math.round(fx.acc), ts: Date.now(), sharing: true, name: S.me.name, avatar: S.me.avatar };
  if (NativeApp && document.hidden && nativeCtx()) NativeApp.writePresence(nativeCtx(), S.gid, doc).catch(e => { log('Position en arrière-plan : ' + e.message); S.sync.setPresence(S.gid, doc).catch(() => {}); });
  else S.sync.setPresence(S.gid, doc).catch(() => {});
  if (NativeApp && document.hidden) bgAlerts();
}
// Accès direct à Firestore pour l'appli en arrière-plan (jeton du compte anonyme)
function nativeCtx() {
  const sy = S.sync, u = sy && sy.kind === 'firebase' && sy.auth && sy.auth.currentUser, cfg = sy && sy.config;
  return u && cfg ? { projectId: cfg.projectId, apiKey: cfg.apiKey, user: u } : null;
}
// Alertes du groupe pendant que le téléphone est dans la poche : notification du téléphone
let bgAlertT = 0, bgSince = 0;
const nativeNotified = new Set();
function bgAlerts() {
  if (!NativeApp || !S.gid || !nativeCtx() || Date.now() - bgAlertT < 30000) return;
  bgAlertT = Date.now();
  NativeApp.eventsSince(nativeCtx(), S.gid, bgSince || Date.now() - 60000).then(list => {
    for (const ev of list) { bgSince = Math.max(bgSince, ev.ts || 0); if (ev.uid !== S.uid) nativeNotify(ev); }
  }).catch(e => log('Alertes en arrière-plan : ' + e.message));
}
function nativeNotify(ev) {
  if (!NativeApp || nativeNotified.has(ev.id) || ev.type === 'hidden') return;
  nativeNotified.add(ev.id);
  const d = GPS.fix && ev.lat ? Game.haversine([GPS.fix.lat, GPS.fix.lng], [ev.lat, ev.lng]) : null;
  NativeApp.notify(evText(ev), (d != null ? 'À ' + fmtKm(d) + ' de toi. ' : '') + 'Touche pour ouvrir la carte.');
}
document.addEventListener('visibilitychange', () => {
  if (!IN_APP) return;
  if (document.hidden) { bgSince = Math.max(bgSince, Date.now() - 5000); if (NativeApp) NativeApp.warmToken(nativeCtx()); }
  else bgSince = 0;
});
// immobile (pause, pique-nique), le suivi natif ne réveille plus la page : on regarde quand même les alertes
setInterval(() => { if (IN_APP && document.hidden && GPS.native && S.gid) bgAlerts(); }, 45000);
function drawSortie() {
  const s = S.sortie, L = M.L;
  M.layers.track.clearLayers(); M.layers.car.clearLayers();
  if (!s) return;
  if (s.track.length > 1) L.polyline(s.track.map(p => [p[0], p[1]]), { color: '#1F5C3A', weight: 5, opacity: 0.85, lineCap: 'round', interactive: false }).addTo(M.layers.track);
  if (s.car) L.marker([s.car.lat, s.car.lng], { icon: L.divIcon({ className: '', html: '<div class="car">' + ICON.car + '</div>', iconSize: [36, 36], iconAnchor: [18, 18] }), title: 'Ma voiture' }).on('click', openCompass).addTo(M.layers.car);
}
let compassOpen = null, headingDeg = null;
function onOrient(e) {
  if (typeof e.webkitCompassHeading === 'number') headingDeg = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === 'number') headingDeg = (360 - e.alpha) % 360;
  else return;
  if (compassOpen) compassOpen();
  if (Route.active) routeArrow();
  if (meMarker && !orientT) orientT = setTimeout(() => { orientT = null; meState(); }, 250);
}
let orientT = null, compassOn = false;
// La boussole du téléphone (sur iPhone, l'autorisation doit être demandée pendant un appui)
function askCompass() {
  if (compassOn) return;
  compassOn = true;
  const listen = () => { window.addEventListener('deviceorientationabsolute', onOrient); window.addEventListener('deviceorientation', onOrient); };
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') listen(); }).catch(() => { compassOn = false; });
    else listen();
  } catch (e) { compassOn = false; }
}
async function openCompass() {
  const s = S.sortie;
  if (!s || !s.car) { toast(s ? 'Position de la voiture pas encore enregistrée (en attente du GPS).' : 'Démarrez une sortie pour enregistrer la voiture.'); return; }
  askCompass();
  const card = openModal(modalHead('Retour à la voiture') + '<div class="compass"><div class="arrow" id="cp-arrow"><svg width="80" height="80" viewBox="0 0 24 24" fill="var(--accent)" aria-hidden="true"><path d="M12 2l6 18-6-4-6 4z"/></svg></div><div class="dist" id="cp-dist">—</div><div class="note" id="cp-note">Tenez le téléphone à plat.</div></div><div class="actions"><button class="btn primary block" data-act="route-car">Itinéraire à pied jusqu\'à la voiture</button></div>', () => { compassOpen = null; });
  compassOpen = () => {
    if (!GPS.fix) return;
    const d = Game.haversine([GPS.fix.lat, GPS.fix.lng], [s.car.lat, s.car.lng]), b = Game.bearing([GPS.fix.lat, GPS.fix.lng], [s.car.lat, s.car.lng]);
    card.querySelector('#cp-dist').textContent = fmtKm(d);
    const rot = headingDeg == null ? b : b - headingDeg;
    card.querySelector('#cp-arrow').style.transform = 'rotate(' + rot + 'deg)';
    card.querySelector('#cp-note').textContent = headingDeg == null ? 'Flèche orientée vers le nord en haut (boussole indisponible).' : 'Suivez la flèche.';
  };
  compassOpen();
}
function openEndSortie() {
  const s = S.sortie; if (!s) return;
  if (!S.sync) { toast('Pas encore connecté au jeu : la sortie continue, réessayez dans un instant.', 5000); startSync(); return; }
  const dur = Date.now() - s.start;
  const walk = Game.sortiePoints(s), gained = Math.max(0, (S.prof ? S.prof.xp : 0) - (s.xp0 || 0)) + walk;
  const species = [...new Set(s.finds.map(f => f.species))].map(id => (Game.SPECIES_BY_ID[id] || {}).n).filter(Boolean);
  const card = openModal(modalHead('Fin de la sortie') +
    '<div class="stats"><div class="stat"><b>' + fmtDur(dur) + '</b><small>durée</small></div><div class="stat"><b>' + fmtKm(s.dist) + '</b><small>parcourus</small></div><div class="stat"><b>' + s.finds.length + '</b><small>trouvailles</small></div><div class="stat"><b>' + gained + '</b><small>points gagnés</small></div></div>' +
    '<p class="note" style="margin:10px 0 0">Dont ' + walk + ' point' + (walk > 1 ? 's' : '') + ' de marche' + (s.dist < 500 ? ' (comptés à partir de 500 m parcourus)' : '') + '.</p>' +
    (species.length ? '<p style="margin:12px 0 0">Espèces : ' + esc(species.join(', ')) + '</p>' : '') +
    '<div class="toggle-row" style="margin-top:8px"><span>Partager le carnet au groupe<small>Parcours, distance et espèces partagées ; les coins secrets restent secrets</small></span><input type="checkbox" class="switch" id="es-share"' + (S.gid ? ' checked' : ' disabled') + '></div>' +
    '<div class="actions"><button class="btn forest block" data-act="es-save">Enregistrer la sortie</button><button class="btn block" data-act="modal-close">Continuer la balade</button><button class="btn danger block" data-act="es-discard">Abandonner sans enregistrer</button></div>');
  card.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'es-save') { finishSortie(true, card.querySelector('#es-share').checked); closeModal(); toast('Sortie enregistrée : +' + gained + ' points.'); }
    if (a.dataset.act === 'es-discard') { if (a.dataset.confirm) { finishSortie(false); closeModal(); toast('Sortie abandonnée'); } else { a.dataset.confirm = '1'; a.textContent = 'Confirmer l\'abandon'; } }
  });
}
function finishSortie(save, share) {
  const s = S.sortie; if (!s) return;
  if (save && S.sync) {
    const track = Game.simplifyTrack(s.track.map(p => [p[0], p[1]]), 5);
    const rec = { id: s.id, start: s.start, end: Date.now(), dist: Math.round(s.dist), track: Game.encodeTrack(track), finds: s.finds.map(f => ({ species: f.species, qty: f.qty, vis: f.vis || 'prive' })), species: [...new Set(s.finds.map(f => f.species))], name: S.me ? S.me.name : '', avatar: S.me ? S.me.avatar : null, commune: s.track.length ? M.communeCached(s.track[0][0], s.track[0][1]) : null };
    const pubFinds = s.finds.filter(f => f.vis && f.vis !== 'prive');
    const pub = share && S.gid ? Object.assign({}, rec, { finds: pubFinds.map(f => ({ species: f.species, qty: f.qty })), species: [...new Set(pubFinds.map(f => f.species))] }) : null;
    S.sync.saveSortie(rec, S.gid, pub).catch(() => {});
  }
  if (s.share && S.gid && !S.settings.liveShare) S.sync.setPresence(S.gid, { sharing: false, ts: Date.now() }).catch(() => {});
  S.sortie = null; store.set('cc.sortie', null);
  clearInterval(sortieTimer); $('#sortie-bar').hidden = true;
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  gpsStop('sortie'); drawSortie();
  setTimeout(() => M.map.invalidateSize(), 50);
}

// ---------------------------------------------------------------- itinéraire dans l'appli
// Chemin à pied calculé par l'IGN (routes, chemins et sentiers de la BD TOPO), plus la ligne droite vers la cible.
const Route = { active: false, dest: null, path: null, arrived: false, seq: 0 };
const WALK = 1.15; // m/s : allure de cueilleur sur chemin forestier
function startRoute(dest) {
  askCompass();
  Route.seq++; const seq = Route.seq;
  Route.active = true; Route.dest = dest; Route.path = null; Route.arrived = false;
  gpsStart('route');
  $('#route-bar').hidden = false; $('#rb-dist').textContent = '…'; $('#rb-sub').textContent = 'Calcul de l\'itinéraire vers ' + dest.name + '…';
  $('#rb-maps').href = 'https://www.google.com/maps/dir/?api=1&destination=' + dest.lat.toFixed(6) + ',' + dest.lng.toFixed(6);
  closeModal(); openTab('carte'); setSheet('peek');
  setTimeout(() => M.map.invalidateSize(), 50);
  (async () => {
    const fx = await oneFix(60000);
    if (seq !== Route.seq) return;
    if (!fx) { $('#rb-sub').textContent = 'Position introuvable : active la localisation.'; drawRoute(); M.map.setView([dest.lat, dest.lng], Math.max(M.map.getZoom(), 15)); return; }
    drawRoute(); fitRoute(); routeTick();
    const path = await fetchPath(fx, dest);
    if (seq !== Route.seq) return;
    Route.path = path; drawRoute(); routeTick();
    if (!path && Game.haversine([fx.lat, fx.lng], [dest.lat, dest.lng]) > 80) log('Itinéraire : ligne directe seulement');
  })();
}
function stopRoute() {
  Route.seq++; Route.active = false; Route.dest = null; Route.path = null;
  M.layers.route.clearLayers(); $('#route-bar').hidden = true; gpsStop('route');
  setTimeout(() => M.map.invalidateSize(), 50);
}
const polyLen = pts => { let d = 0; for (let i = 1; i < pts.length; i++) d += Game.haversine(pts[i - 1], pts[i]); return d; };
// Graphes piétons de l'IGN (BD TOPO, chemins et sentiers compris) : le premier qui répond est retenu pour la suite
const ROUTE_RES = ['bdtopo-pgr', 'bdtopo-valhalla'];
async function fetchPath(a, b) {
  const direct = Game.haversine([a.lat, a.lng], [b.lat, b.lng]);
  if (direct < 80) return null;
  const pref = store.get('cc.routeRes', null), order = pref && ROUTE_RES.includes(pref) ? [pref, ...ROUTE_RES.filter(x => x !== pref)] : ROUTE_RES;
  for (const res of order) {
    const url = 'https://data.geopf.fr/navigation/itineraire?resource=' + res + '&profile=pedestrian&optimization=shortest&start=' + a.lng.toFixed(6) + ',' + a.lat.toFixed(6) + '&end=' + b.lng.toFixed(6) + ',' + b.lat.toFixed(6) + '&geometryFormat=geojson&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second';
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text().catch(() => '')).slice(0, 120));
      const j = await r.json();
      let g = j.geometry; if (typeof g === 'string') g = JSON.parse(g);
      if (!g || !Array.isArray(g.coordinates) || g.coordinates.length < 2) throw new Error('réponse sans tracé');
      store.set('cc.routeRes', res);
      const pts = g.coordinates.map(p => [p[1], p[0]]);
      const len = polyLen(pts);
      if (len > direct * 4 + 2000) { log('Itinéraire IGN : détour trop long (' + Math.round(len) + ' m)'); return null; }
      return pts;
    } catch (e) {
      log('Itinéraire IGN (' + res + ') : ' + (e.name === 'AbortError' ? 'délai dépassé' : e.message));
      if (e.name === 'AbortError' || navigator.onLine === false) return null;
    } finally { clearTimeout(t); }
  }
  return null;
}
function fitRoute() {
  const d = Route.dest, me = GPS.fix; if (!d) return;
  const pts = [[d.lat, d.lng]]; if (me) pts.push([me.lat, me.lng]); if (Route.path) pts.push(...Route.path);
  if (pts.length > 1) M.map.fitBounds(pts, { padding: [50, 50], maxZoom: 17 }); else M.map.setView(pts[0], 16);
  setFollow(false);
}
let routeDirect = null;
function drawRoute() {
  const lay = M.layers.route, L = M.L, d = Route.dest; lay.clearLayers(); routeDirect = null;
  if (!Route.active || !d) return;
  if (Route.path) {
    L.polyline(Route.path, { color: '#FFFFFF', weight: 9, opacity: 0.85, interactive: false, lineJoin: 'round' }).addTo(lay);
    L.polyline(Route.path, { color: '#4A2C8F', weight: 5, opacity: 0.95, interactive: false, lineJoin: 'round' }).addTo(lay);
    L.polyline([Route.path[Route.path.length - 1], [d.lat, d.lng]], { color: '#4A2C8F', weight: 4, opacity: 0.9, dashArray: '1 9', lineCap: 'round', interactive: false }).addTo(lay);
  }
  routeDirect = L.polyline(GPS.fix ? [[GPS.fix.lat, GPS.fix.lng], [d.lat, d.lng]] : [[d.lat, d.lng]], { color: '#C8921A', weight: 3, opacity: 0.95, dashArray: '8 8', interactive: false }).addTo(lay);
  L.marker([d.lat, d.lng], { icon: L.divIcon({ className: '', html: '<div class="dest-pin"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4h11l-2 4 2 4H5"/></svg></div>', iconSize: [36, 44], iconAnchor: [18, 42] }), pane: 'people', interactive: false }).addTo(lay);
}
// Distance restante le long du chemin : du point du tracé le plus proche jusqu'au bout, puis jusqu'à la cible
function pathRemaining(path, me, d) {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < path.length; i++) { const q = Game.haversine([me.lat, me.lng], path[i]); if (q < bd) { bd = q; bi = i; } }
  let rest = bd;
  for (let i = bi; i < path.length - 1; i++) rest += Game.haversine(path[i], path[i + 1]);
  return rest + Game.haversine(path[path.length - 1], [d.lat, d.lng]);
}
const CARD = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'];
function routeTick() {
  const d = Route.dest, me = GPS.fix;
  if (!Route.active || !d || !me) return;
  const direct = Game.haversine([me.lat, me.lng], [d.lat, d.lng]);
  const remain = Route.path ? Math.max(direct, pathRemaining(Route.path, me, d)) : direct;
  if (routeDirect) routeDirect.setLatLngs([[me.lat, me.lng], [d.lat, d.lng]]);
  Route.bearing = Game.bearing([me.lat, me.lng], [d.lat, d.lng]);
  $('#rb-dist').textContent = fmtKm(remain);
  const min = Math.max(1, Math.round(remain / WALK / 60));
  $('#rb-sub').textContent = 'Vers ' + d.name + ' · ' + (min < 60 ? min + ' min' : Math.floor(min / 60) + ' h ' + String(min % 60).padStart(2, '0')) + ' à pied' + (Route.path ? ' · ' + fmtKm(direct) + ' à vol d\'oiseau' : ' · tout droit, cap ' + CARD[Math.round(Route.bearing / 45) % 8]);
  routeArrow();
  if (direct <= Math.max(15, Math.min(35, me.acc)) && !Route.arrived) { Route.arrived = true; vibrate([80, 50, 80]); toast('Tu es arrivé : ' + d.name + ' !', 5000); }
}
function routeArrow() {
  if (Route.bearing == null) return;
  const hd = headingDeg != null ? headingDeg : null;
  $('#rb-arrow').style.transform = 'rotate(' + Math.round(hd == null ? Route.bearing : Route.bearing - hd) + 'deg)';
  $('#rb-arrow').title = hd == null ? 'Direction par rapport au nord (haut de la carte)' : 'Direction à suivre';
  if (pocketOn) renderPocket();
}
// Ami suivi : la cible se déplace avec lui
function routeFollowFriend() {
  const d = Route.dest; if (!Route.active || !d || d.kind !== 'friend') return;
  const p = S.presence.find(x => x.id === d.uid); if (!p || !p.lat) return;
  const moved = Game.haversine([d.lat, d.lng], [p.lat, p.lng]);
  if (moved < 5) return;
  d.lat = p.lat; d.lng = p.lng;
  if (Route.path && moved > 150) Route.path = null; // trop loin du tracé : la ligne directe prend le relais
  drawRoute(); routeTick();
}

// ---------------------------------------------------------------- mode poche
// Écran noir verrouillé : l'appli reste au premier plan, l'écran allumé, donc le GPS et le partage continuent
let pocketOn = false, pocketClock = null, pocketHold = null;
function pocketEnter() {
  pocketOn = true; $('#pocket').hidden = false; requestWake();
  try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}); } catch (e) { /* facultatif */ }
  renderPocket(); clearInterval(pocketClock); pocketClock = setInterval(renderPocket, 1000);
}
function pocketExit() {
  pocketOn = false; $('#pocket').hidden = true; clearInterval(pocketClock);
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* facultatif */ }
  if (!(S.sortie && S.sortie.wake) && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
function renderPocket() {
  if (!pocketOn) return;
  const now = new Date();
  $('#pk-clock').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const s = S.sortie, routing = Route.active && Route.dest && GPS.fix;
  if (s) {
    const sec = Math.floor((Date.now() - s.start) / 1000);
    $('#pk-big').textContent = fmtKm(s.dist);
    $('#pk-sub').textContent = Math.floor(sec / 3600) + ' h ' + String(Math.floor(sec / 60) % 60).padStart(2, '0') + ' de sortie · ' + s.finds.length + ' trouvaille' + (s.finds.length > 1 ? 's' : '');
  } else if (routing) { $('#pk-big').textContent = $('#rb-dist').textContent; $('#pk-sub').textContent = 'vers ' + Route.dest.name; }
  else { $('#pk-big').textContent = '—'; $('#pk-sub').textContent = 'Ta position reste suivie tant que l\'écran est allumé'; }
  $('#pk-tip').textContent = IN_APP ? (GPS.native ? 'Tu peux éteindre l\'écran et ranger le téléphone : ta position reste suivie (notification « Coins à champi »).' : 'Pour garder ta position écran éteint, lance une sortie ou un itinéraire.') : wakeFail ? (/iPhone|iPad/.test(navigator.userAgent) ? 'Ce téléphone ne garde pas l\'écran allumé tout seul : Réglages → Luminosité et affichage → Verrouillage automatique → Jamais, le temps de la sortie.' : 'Ce téléphone ne garde pas l\'écran allumé tout seul : Paramètres → Affichage → Mise en veille de l\'écran → 30 minutes, le temps de la sortie.') : 'Range le téléphone écran allumé, sans le verrouiller : l\'écran noir consomme peu et ignore les appuis.';
  $('#pk-live').textContent = sharingNow() ? 'Position partagée avec le groupe' : 'Position non partagée';
  $('#pk-live').classList.toggle('on', sharingNow());
  $('#pk-gps').textContent = !GPS.fix ? 'GPS : recherche…' : Date.now() - GPS.fix.ts > 60000 ? 'GPS : pas de nouvelle position depuis ' + Math.round((Date.now() - GPS.fix.ts) / 60000) + ' min' : 'GPS : ± ' + Math.round(GPS.fix.acc) + ' m';
  const r = $('#pk-route');
  if (routing) {
    r.hidden = false;
    $('#pk-rdist').textContent = $('#rb-dist').textContent + ' vers ' + Route.dest.name;
    $('#pk-rarrow').style.transform = $('#rb-arrow').style.transform;
  } else r.hidden = true;
}
function wirePocket() {
  const btn = $('#pk-unlock'), ring = btn.querySelector('.pk-ring');
  const cancel = () => { clearTimeout(pocketHold); pocketHold = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('holding'); pocketHold = setTimeout(() => { cancel(); pocketExit(); vibrate(40); }, 1200); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, cancel));
  // tout autre appui est ignoré
  $('#pocket').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); }, true);
  $('#pocket').addEventListener('contextmenu', e => e.preventDefault());
  if (ring) ring.setAttribute('aria-hidden', 'true');
}

// ---------------------------------------------------------------- traces et brouillard
const fogOn = () => $('#lyr-fog').checked;
function renderTracksAndFog() {
  if (!M) return;
  const tracks = [];
  S.mySorties.forEach(s => tracks.push({ pts: Game.decodeTrack(s.track || ''), mine: true }));
  S.carnets.filter(c => c.uid !== S.uid).forEach(c => tracks.push({ pts: Game.decodeTrack(c.track || ''), mine: false }));
  const lay = M.layers.tracks; lay.clearLayers();
  if ($('#lyr-tracks').checked) {
    tracks.forEach(t => { if (t.pts.length > 1) M.L.polyline(t.pts, { color: t.mine ? '#4A2C8F' : '#1F5C3A', weight: 3, opacity: 0.55, dashArray: t.mine ? null : '6 6', interactive: false }).addTo(lay); });
    if (!M.map.hasLayer(lay)) lay.addTo(M.map);
  } else if (M.map.hasLayer(lay)) M.map.removeLayer(lay);
  if (fogOn()) {
    const cells = new Set();
    tracks.forEach(t => Game.exploredCells(t.pts, cells));
    if (S.sortie) Game.exploredCells(S.sortie.track, cells);
    M.setFog(cells);
  } else M.setFog(null);
}

// ---------------------------------------------------------------- panneaux
function openTab(name) {
  S.tab = name;
  document.querySelectorAll('.tabs [data-tab]').forEach(b => b.toggleAttribute('aria-current', false));
  const btn = document.querySelector('.tabs [data-tab="' + name + '"]'); if (btn) btn.setAttribute('aria-current', 'page');
  destroyStages('panel');
  document.body.classList.toggle('panel-open', name !== 'carte');
  if (name === 'carte') { $('#panel').hidden = true; setTimeout(() => M.map.invalidateSize(), 30); return; }
  $('#panel').hidden = false; $('#panel').scrollTop = 0;
  renderPanel(name);
}
function renderPanelIfOpen(name) { if (S.tab === name && !$('#panel').hidden) renderPanel(name); }
let panelT = null;
function renderPanel(name) {
  clearTimeout(panelT);
  panelT = setTimeout(() => {
    const top = $('#panel').scrollTop;
    destroyStages('panel');
    if (name === 'groupe') renderGroupPanel();
    else if (name === 'mycodex') learn.render($('#panel-inner'));
    else if (name === 'profil') renderProfil();
    $('#panel').scrollTop = top;
  }, 40);
}
function renderGroupPanel() {
  const el = $('#panel-inner');
  if (!S.sync) { el.innerHTML = '<h2>Groupe</h2><p class="lead">Connexion au jeu…</p>'; return; }
  if (!S.gid) {
    el.innerHTML = '<h2>Groupe</h2><p class="lead">Jouez avec vos amis : positions en direct pendant les sorties, trouvailles partagées, défis et cèpes d\'or.</p><div class="card"><button class="btn primary block" data-act="group-choose">Créer ou rejoindre un groupe</button></div>' + (S.sync.kind === 'local' ? '<p class="note">Mode solo : le groupe restera sur ce téléphone tant que Firebase n\'est pas configuré.</p>' : '');
    return;
  }
  const g = S.group || { name: '…' };
  const isOwner = !!(S.group && S.group.owner === S.uid);
  const members = S.members.slice().sort((a, b) => (b.xp || 0) - (a.xp || 0));
  const pres = Object.fromEntries(S.presence.map(p => [p.id, p]));
  const chal = Game.weekChallenges(new Date(), S.groupFinds, S.carnets);
  const claimed = (S.me && S.me.claimed) || [];
  const treasures = S.treasures.filter(t => t.type === 'treasure' && (activeTreasure(t) || (t.foundBy && Date.now() - t.foundAt < 7 * 86400e3)));
  const feed = [
    ...S.groupFinds.slice(0, 12).map(f => ({ ts: f.ts, html: '<img class="th" alt="" src="' + (f.thumb || speciesImg(f.species, 64)) + '"><div class="grow"><b>' + esc(f.uid === S.uid ? 'Vous' : f.name || 'Un ami') + '</b> · ' + esc((Game.SPECIES_BY_ID[f.species] || {}).n || '') + '<small>' + esc(ago(f.ts)) + (f.commune ? ' · ' + esc(f.commune) : '') + (f.likedBy && f.likedBy.length ? ' · ' + f.likedBy.length + ' bravo' + (f.likedBy.length > 1 ? 's' : '') : '') + '</small></div>', act: 'feed-find', id: f.id })),
    ...S.carnets.slice(0, 8).map(c => ({ ts: c.end || c.start, html: '<img class="av" alt="" src="' + avatarImg(c.avatar, 80) + '"><div class="grow"><b>' + esc(c.uid === S.uid ? 'Vous' : c.name || 'Un ami') + '</b> · sortie de ' + fmtKm(c.dist || 0) + '<small>' + esc(ago(c.end || c.start)) + (c.commune ? ' · ' + esc(c.commune) : '') + (c.species && c.species.length ? ' · ' + c.species.length + ' espèce(s)' : '') + '</small></div>', act: 'feed-carnet', id: c.id }))
  ].sort((a, b) => b.ts - a.ts).slice(0, 14);
  el.innerHTML = '<h2>' + esc(g.name) + '</h2>' +
    '<div class="card"><h3>Code d\'invitation</h3><div class="row"><span class="code grow">' + esc(S.gid) + '</span><button class="btn small" data-act="group-share">Inviter</button></div><p class="note" style="margin:8px 0 0">Vos amis ouvrent l\'appli, créent leur champignon et entrent ce code.</p></div>' +
    '<div class="card"><h3>Classement</h3><div class="members">' + (members.length ? members.map((m, i) => { const p = pres[m.id]; const live = p && p.sharing && Date.now() - p.ts < 180e3; const lv = Game.levelOf(m.xp || 0); return '<div class="member"><span class="rank">' + (i + 1) + '</span><img alt="" src="' + avatarImg(m.avatar, 92) + '"><div class="grow"><b>' + esc(m.name || 'Ami') + (m.id === S.uid ? ' (vous)' : '') + '</b><small>Niv. ' + lv.level + ' · ' + esc(lv.name) + (live ? ' · <span style="color:var(--good);font-weight:700">en direct</span>' : '') + '</small></div><span class="xp">' + (m.xp || 0) + ' pts</span>' + (isOwner && m.id !== S.uid ? '<button class="btn small" data-act="member-remove" data-id="' + esc(m.id) + '" aria-label="Retirer ' + esc(m.name || 'ce membre') + ' du groupe">Retirer</button>' : '') + '</div>'; }).join('') : '<p class="note">Aucun membre pour l\'instant.</p>') + '</div>' + (isOwner ? '<p class="note" style="margin:8px 0 0">Tu as créé ce groupe : tu peux en retirer un membre (par exemple un champignon en double).</p>' : '') + '</div>' +
    '<div class="card"><h3>Défis de la semaine</h3>' + chal.map(c => { const got = claimed.includes(c.key); return '<div class="chal"><div class="chal-head"><b>' + esc(c.n) + '</b>' + (c.done ? (got ? '<span class="tag ok">Récupéré</span>' : '<button class="btn small primary" data-act="claim" data-key="' + esc(c.key) + '">+' + Game.CHALLENGE_PTS + ' points</button>') : '<span class="tag">' + (Math.round(c.value * 10) / 10).toLocaleString('fr-FR') + ' / ' + c.target + ' ' + esc(c.unit) + '</span>') + '</div><span class="note">' + esc(c.d) + '</span><div class="progress"><b style="width:' + Math.min(100, Math.round(100 * c.value / c.target)) + '%"></b></div></div>'; }).join('') + '<p class="note" style="margin:8px 0 0">Seules les trouvailles partagées comptent. Nouveaux défis chaque lundi.</p></div>' +
    '<div class="card"><h3>Cèpes d\'or</h3>' + (treasures.length ? treasures.map(t => '<div class="li" data-act="treasure-open" data-id="' + esc(t.id) + '" style="cursor:pointer"><div class="tz' + (t.foundBy ? ' found' : '') + '" style="flex:none">' + (t.foundBy ? '★' : '?') + '</div><div class="grow"><b>' + (t.foundBy ? 'Trouvé par ' + esc(t.foundByName || 'un ami') : 'Caché par ' + esc(t.createdBy === S.uid ? 'vous' : t.name || 'un ami')) + '</b><small>' + (t.hint ? esc(t.hint) : 'Sans indice') + '</small>' + (!t.foundBy && t.createdBy !== S.uid ? hotCold(t) : '') + '</div></div>').join('') : '<p class="note">Aucun trésor en cours.</p>') + '<div class="actions"><button class="btn gold" data-act="treasure-hide">Cacher un cèpe d\'or</button></div></div>' +
    '<div class="card"><h3>Activité</h3><div class="feed">' + (feed.length ? feed.map(f => '<div class="feed-item" data-act="' + f.act + '" data-id="' + esc(f.id) + '" style="cursor:pointer">' + f.html + '</div>').join('') : '<p class="note">Rien pour l\'instant : partez en sortie !</p>') + '</div></div>' +
    '<div class="actions"><button class="btn" data-act="group-choose">Changer de groupe</button><button class="btn danger" data-act="group-leave">Quitter le groupe</button></div>';
}
function mycodexHtml() {
  const per = (S.prof && S.prof.stats.perSpecies) || {};
  const list = Game.CATALOG.filter(s => s.id !== 'autre'), found = list.filter(s => per[s.id]).length;
  return '<h2>Mycodex</h2><p class="lead">' + found + ' espèce' + (found > 1 ? 's' : '') + ' trouvée' + (found > 1 ? 's' : '') + ' sur ' + list.length + '. Chaque nouvelle espèce rapporte double.</p>' +
    '<div class="progress"><b style="width:' + Math.round(100 * found / list.length) + '%"></b></div>' +
    '<div class="dex">' + list.map(s => '<button class="' + (per[s.id] ? '' : 'locked') + '" data-act="species" data-id="' + s.id + '"><img alt="" src="' + speciesImg(s.id, 128) + '">' + esc(per[s.id] ? s.n : '???') + '<small>' + (per[s.id] ? per[s.id] + ' trouvaille' + (per[s.id] > 1 ? 's' : '') : s.pts + ' pts') + '</small></button>').join('') + '</div>';
}
function renderMycodex() { renderPanelIfOpen('mycodex'); }
function openSpecies(id) {
  const s = Game.SPECIES_BY_ID[id]; if (!s) return;
  const core = s.core ? C.SPECIES.find(x => x.id === s.core) : null;
  const mine = S.myFinds.filter(f => f.species === id);
  const found = mine.length > 0;
  const card = openModal(modalHead(found ? s.n : 'Espèce à découvrir') + '<img alt="" src="' + speciesImg(id, 200) + '" style="width:150px;display:block;margin:0 auto;' + (found ? '' : 'filter:brightness(0) opacity(.25)') + '">' +
    (found ? '<div class="latin" style="text-align:center;margin-top:6px">' + esc(s.lat) + '</div>' : '<p style="text-align:center" class="note">Trouvez-la pour la débloquer : ' + s.pts * 2 + ' points la première fois.</p>') +
    (found ? '<p>' + esc(core ? core.hab : s.hab) + '</p><div class="warnbox"><b>Confusions :</b> ' + esc(core ? core.conf : s.conf) + '</div>' : '<p class="note">Indice : ' + esc((core ? core.hab : s.hab).split(/[,.;]/)[0]) + '.</p>') +
    (mine.length ? '<h3 style="margin-top:14px">Vos trouvailles</h3><div class="list">' + mine.slice(0, 20).map(f => '<div class="li" data-act="myfind" data-id="' + esc(f.id) + '" style="cursor:pointer"><img alt="" src="' + (f.thumb || speciesImg(f.species, 64)) + '"><div class="grow">' + esc(dateFr(f.ts)) + '<small>' + esc((Game.QTY[f.qty] || Game.QTY[1]).n) + (f.commune ? ' · ' + esc(f.commune) : '') + (f.vis === 'prive' ? ' · secret' : '') + '</small></div></div>').join('') + '</div>' : '') +
    '<div class="actions">' + (learn.ficheForGame(id) ? '<button class="btn" data-act="en-open" data-id="' + esc(learn.ficheForGame(id)) + '">Fiche complète</button>' : '') + (core ? '<button class="btn primary" data-act="species-map" data-id="' + esc(core.id) + '">Voir ses coins sur la carte</button>' : '') + '</div>');
  card.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'species-map') { closeModal(); selectSp(a.dataset.id); }
  });
}
function renderProfil() {
  const el = $('#panel-inner');
  if (!S.me) { el.innerHTML = '<h2>Profil</h2><div class="card"><div class="actions" style="flex-direction:column"><button class="btn primary block" data-act="ob-start">Créer mon champignon</button>' + (hasAccounts() ? '<button class="btn block" data-act="acc-login">J\'ai déjà un compte</button>' : '') + '</div></div>'; return; }
  const p = S.prof || Game.computeProfile([], [], S.me);
  const st = p.stats, next = p.next;
  el.innerHTML = '<div class="avatar-hero"><canvas id="pf-stage" aria-label="Votre champignon en 3D"></canvas><div><h2>' + esc(S.me.name) + '</h2><div class="level-name">Niveau\u00a0' + p.level + ' · ' + esc(p.name) + '</div><div class="progress" style="margin:8px 0 4px"><b style="width:' + Math.round(100 * p.progress) + '%"></b></div><small class="note">' + p.xp + ' points' + (next ? ' · encore ' + (next - p.xp) + ' pour le niveau\u00a0' + (p.level + 1) : ' · niveau maximal') + '</small><div class="actions"><button class="btn small" data-act="edit-avatar">Modifier mon champignon</button></div></div></div>' +
    '<div class="stats"><div class="stat"><b>' + st.finds + '</b><small>trouvailles</small></div><div class="stat"><b>' + st.species.length + '</b><small>espèces</small></div><div class="stat"><b>' + (Math.round(st.km * 10) / 10).toLocaleString('fr-FR') + '</b><small>km</small></div><div class="stat"><b>' + st.sorties + '</b><small>sorties</small></div></div>' +
    '<div class="card"><h3>Badges · ' + p.badges.length + '/' + Game.BADGES.length + '</h3><div class="badges">' + Game.BADGES.map(b => '<div class="badge' + (p.badges.includes(b.id) ? '' : ' locked') + '"><span class="medal">' + medalSvg(b.icon) + '</span>' + esc(b.n) + '<small>' + esc(b.d) + '</small></div>').join('') + '</div></div>' +
    '<div class="card"><h3>Mes sorties</h3><div class="list">' + (S.mySorties.length ? S.mySorties.slice(0, 15).map(s => '<div class="li" data-act="sortie-show" data-id="' + esc(s.id) + '" style="cursor:pointer"><div class="grow"><b>' + esc(dateFr(s.start)) + '</b><small>' + fmtKm(s.dist || 0) + ' · ' + fmtDur((s.end || s.start) - s.start) + (s.commune ? ' · ' + esc(s.commune) : '') + ' · ' + ((s.finds || []).length) + ' trouvaille(s)</small></div></div>').join('') : '<p class="note">Démarrez une sortie depuis le bouton « Sortie » de la carte.</p>') + '</div></div>' +
    '<div class="card"><h3>Mes trouvailles</h3><div class="list">' + (S.myFinds.length ? S.myFinds.slice(0, 30).map(f => '<div class="li" data-act="myfind" data-id="' + esc(f.id) + '" style="cursor:pointer"><img alt="" src="' + (f.thumb || speciesImg(f.species, 64)) + '"><div class="grow"><b>' + esc((Game.SPECIES_BY_ID[f.species] || {}).n || '') + '</b><small>' + esc(dateFr(f.ts)) + (f.commune ? ' · ' + esc(f.commune) : '') + ' · ' + esc(f.vis === 'prive' ? 'secret' : f.vis === 'flou' ? 'partagé flouté' : 'partagé') + '</small></div></div>').join('') : '<p class="note">Touchez « Trouvaille » pour enregistrer votre premier coin.</p>') + '</div></div>' +
    '<div class="card"><h3>Réglages</h3>' +
    '<div class="toggle-row"><span>Afficher ma position sur la carte<small>Ton champignon suit tes déplacements dès que l\'appli est ouverte</small></span><input type="checkbox" class="switch" id="st-loc"' + (store.get('cc.autoloc', null) !== false && GPS.watch != null ? ' checked' : '') + '></div>' +
    '<div class="toggle-row"><span>Partager ma position avec le groupe dès que l\'appli est ouverte<small>Sinon, seulement pendant les sorties où tu l\'as choisi</small></span><input type="checkbox" class="switch" id="st-live"' + (S.settings.liveShare ? ' checked' : '') + (S.gid ? '' : ' disabled') + '></div>' +
    '<div class="toggle-row"><span>Partager ma position en sortie par défaut</span><input type="checkbox" class="switch" id="st-share"' + (S.settings.share ? ' checked' : '') + '></div>' +
    '<div class="toggle-row"><span>Nouvelles trouvailles<small>Visibilité proposée par défaut</small></span><select class="input" id="st-vis" style="width:auto">' + Object.entries(Game.VISIBILITY).map(([k, v]) => '<option value="' + k + '"' + (S.settings.vis === k ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></div>' +
    (S.sync && S.sync.kind === 'local' ? '<p class="note" style="margin:10px 0 0">Mode solo : votre profil reste sur ce téléphone.</p>' : '') + '</div>' +
    accountCard() +
    (ANDROID_WEB ? '<div class="card"><h3>Appli Android</h3><p>Avec l\'appli, ta position continue d\'être suivie et partagée écran éteint, téléphone dans la poche, et les alertes du groupe arrivent en notification. Tu restes dans les mêmes groupes que les joueurs du site.</p><div class="actions"><a class="btn primary" href="' + APK_URL + '">Télécharger l\'appli</a></div><p class="note" style="margin-top:8px">Ouvre le fichier téléchargé, puis autorise l\'installation depuis ton navigateur. Dans l\'appli, touche « J\'ai déjà un compte » pour retrouver ton champignon (crée d\'abord ton compte ci-dessus).</p></div>' : '') +
    (IN_APP ? '<div class="card"><h3>Appli Android</h3><p class="note" id="app-ver">Version de l\'appli…</p></div>' : '');
  stage(el.querySelector('#pf-stage'), S.me.avatar, { base: true }, 'panel');
  el.querySelector('#st-share').onchange = e => { S.settings.share = e.target.checked; store.set('cc.settings', S.settings); };
  el.querySelector('#st-loc').onchange = e => { store.set('cc.autoloc', e.target.checked); if (e.target.checked) { gpsStart('carte'); GPS.centerNext = true; } else { gpsStop('carte'); setFollow(false); } };
  el.querySelector('#st-live').onchange = e => {
    S.settings.liveShare = e.target.checked; store.set('cc.settings', S.settings);
    if (e.target.checked) { gpsStart('carte'); pushPresence(true); toast('Le groupe voit ta position dès que l\'appli est ouverte.'); }
    else if (S.gid && !(S.sortie && S.sortie.share)) S.sync.setPresence(S.gid, { sharing: false, ts: Date.now() }).catch(() => {});
  };
  el.querySelector('#st-vis').onchange = e => { S.settings.vis = e.target.value; store.set('cc.settings', S.settings); };
  if (IN_APP) fetch('app-version.json').then(r => r.json()).then(v => { const n = el.querySelector('#app-ver'); if (n) n.textContent = 'Appli n° ' + v.build + (v.version && v.version !== 'dev' ? ' (' + v.version + ')' : '') + '. La position continue écran éteint pendant les sorties et les itinéraires.'; }).catch(() => {});
}
function showSortie(s) {
  const pts = Game.decodeTrack(s.track || '');
  openTab('carte');
  M.layers.track.clearLayers();
  if (pts.length > 1) { const line = M.L.polyline(pts, { color: '#4A2C8F', weight: 5, opacity: 0.85 }).addTo(M.layers.track); M.map.fitBounds(line.getBounds(), { padding: [30, 30] }); toast('Trace du ' + new Date(s.start).toLocaleDateString('fr-FR')); }
  else toast('Pas de trace enregistrée pour cette sortie.');
}

// ---------------------------------------------------------------- menu, recherche, hors-ligne
function openDrawer(open) {
  $('#drawer').hidden = !open; $('#scrim').hidden = !open;
  if (open) { $('#q').value = ''; $('#results').innerHTML = ''; }
}
// Recherche d'une commune de France (API Découpage administratif)
let searchT = null, searchSeq = 0;
function search(q) {
  const el = $('#results'), txt = q.trim();
  clearTimeout(searchT);
  if (txt.length < 2) { el.innerHTML = ''; return; }
  searchT = setTimeout(async () => {
    const seq = ++searchSeq;
    el.innerHTML = '<p class="note">Recherche…</p>';
    try {
      const r = await fetch('https://geo.api.gouv.fr/communes?nom=' + encodeURIComponent(txt) + '&fields=nom,code,centre,bbox,departement,population&boost=population&limit=12');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      // d'abord le nom exact, puis les noms qui commencent par la saisie, chaque fois les plus peuplées en tête
      const norm = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[-'’\s]+/g, ' ').trim(), qn = norm(txt);
      const rank = c => { const n = norm(c.nom); return n === qn ? 0 : n.startsWith(qn) ? 1 : n.split(' ').some(w => w.startsWith(qn)) ? 2 : 3; };
      const res = (await r.json()).map((c, i) => ({ c, i, k: rank(c) })).sort((x, y) => x.k - y.k || (y.c.population || 0) - (x.c.population || 0) || x.i - y.i).slice(0, 8).map(x => x.c);
      if (seq !== searchSeq) return;
      S.searchRes = res;
      el.innerHTML = res.length ? res.map((c, i) => '<button data-act="gocommune" data-i="' + i + '">' + esc(c.nom) + ' <small>· ' + esc(c.departement ? c.departement.nom + ' (' + c.departement.code + ')' : c.code) + '</small></button>').join('') : '<p class="note">Aucune commune ne correspond.</p>';
    } catch (e) { if (seq === searchSeq) el.innerHTML = '<p class="note">Recherche impossible sans réseau.</p>'; }
  }, 250);
}
async function downloadZone() {
  const status = t => { $('#dl-status').textContent = t; };
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) { status('Le mode hors réseau s\'active après un premier rechargement de la page (en https).'); return; }
  const b = M.map.getBounds(), z = M.map.getZoom();
  if (z < 12) { status('Zoomez sur la forêt à télécharger (zone trop grande).'); return; }
  const urls = M.tileUrls(b, Math.max(12, z - 1), 17, 3000);
  if (!urls) { status('Zone trop grande : zoomez un peu plus.'); return; }
  if (urls.some(u => /openstreetmap\.org/.test(u))) { status('Le téléchargement fonctionne avec le Plan IGN ou les photos IGN (OpenStreetMap interdit le téléchargement en masse). Changez de fond de carte ci-dessus.'); return; }
  $('#dl-zone').disabled = true;
  try {
    status('Peuplements forestiers…');
    await M.prefetchForests(b.pad(0.1), (d, t) => status('Peuplements forestiers ' + d + '/' + t));
    await Promise.all(M.geolTileUrls(b.pad(0.1)).map(u => fetch(u).catch(() => null)));
    let done = 0;
    for (let i = 0; i < urls.length; i += 6) { await Promise.all(urls.slice(i, i + 6).map(u => fetch(u, { mode: 'no-cors' }).catch(() => null))); done = Math.min(urls.length, i + 6); status('Fond de carte ' + done + '/' + urls.length); }
    status('Zone prête hors réseau : ' + urls.length + ' tuiles, les peuplements et le sol.');
  } finally { $('#dl-zone').disabled = false; }
}

// ---------------------------------------------------------------- interface
function wireUi() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act],[data-sp],[data-tab]');
    if (!t) return;
    if (t.dataset.sp && t.closest('#rail')) { selectSp(t.dataset.sp); return; }
    if (t.dataset.tab) { openTab(t.dataset.tab); return; }
    const a = t.dataset.act, id = t.dataset.id;
    if (/^(learn-|en-|qz-|fc-)/.test(a || '')) {
      if (!$('#modal').hidden) closeModal(true);
      const r = learn.act(a, t);
      if (S.tab !== 'mycodex') { if (r === 'top' || r === 'keep') openTab('mycodex'); return; }
      if (r === 'top') { $('#panel').scrollTop = 0; renderPanel('mycodex'); } else if (r === 'keep') renderPanel('mycodex');
      return;
    }
    switch (a) {
      case 'modal-close': closeModal(); break;
      case 'hideblocked': $('#blocked').hidden = true; break;
      case 'place-ok': endPlacing(true); break;
      case 'place-cancel': endPlacing(false); break;
      case 'closepoint': S.point = null; $('#sec-point').hidden = true; if (pointMarker) { M.map.removeLayer(pointMarker); pointMarker = null; } setSheet('peek'); break;
      case 'zoomhere': if (S.point) M.map.setView([S.point.lat, S.point.lng], 15); break;
      case 'far-go': setSheet('peek'); M.map.setView([+t.dataset.lat, +t.dataset.lon], 11); break;
      case 'far-wx': S.farWx = !!t.checked; store.set('cc.farwx', S.farWx); M.far.setWx(S.farWx); break;
      case 'find-here': if (S.point) openNewFind({ lat: S.point.lat, lng: S.point.lng }); break;
      case 'treasure-here': if (S.point) openHideTreasure({ lat: S.point.lat, lng: S.point.lng }); break;
      case 'massifs': setSheet('open'); { const el = $('#sec-point'); el.hidden = false; S.point = null; el.innerHTML = '<h3>Aller vers un massif</h3><div class="massifs">' + MASSIFS.map((m, i) => '<button class="btn small" data-act="gomassif" data-i="' + i + '">' + esc(m[0]) + '</button>').join('') + '</div>'; } break;
      case 'gomassif': { const m = MASSIFS[+t.dataset.i]; openDrawer(false); $('#sec-point').hidden = true; setSheet('peek'); openTab('carte'); M.map.setView([m[1], m[2]], 14); } break;
      case 'gocommune': {
        const c = (S.searchRes || [])[+t.dataset.i]; if (!c) break;
        openDrawer(false); openTab('carte');
        const ring = c.bbox && c.bbox.coordinates && c.bbox.coordinates[0];
        if (ring) { const lo = ring.map(p => p[0]), la = ring.map(p => p[1]); M.map.fitBounds([[Math.min(...la), Math.min(...lo)], [Math.max(...la), Math.max(...lo)]], { maxZoom: 15 }); }
        else if (c.centre) M.map.setView([c.centre.coordinates[1], c.centre.coordinates[0]], 14);
        setTimeout(() => { if (M.map.getZoom() < M.DATA_Z) M.map.setZoom(M.DATA_Z); }, 400);
      } break;
      case 'retry': M.retry(); break;
      case 'diag': openDrawer(true); break;
      case 'group-choose': openGroupChooser(false); break;
      case 'acc-protect': e.preventDefault(); openProtect(); break;
      case 'acc-login': e.preventDefault(); openLogin(); break;
      case 'acc-reset': accReset(t); break;
      case 'acc-logout': if (t.dataset.confirm) doLogout(); else { t.dataset.confirm = '1'; t.textContent = 'Confirmer : me déconnecter'; } break;
      case 'pw-show': { const f = document.getElementById(t.dataset.for); if (f) { f.type = f.type === 'password' ? 'text' : 'password'; t.textContent = f.type === 'password' ? 'Voir' : 'Cacher'; } } break;
      case 'group-share': shareInvite(); break;
      case 'member-remove': if (t.dataset.confirm) { t.disabled = true; S.sync.removeMember(S.gid, id).then(() => toast('Membre retiré du groupe'), e => { t.disabled = false; toast('Impossible de retirer ce membre : ' + fbWhy(e), 6000); }); } else { t.dataset.confirm = '1'; t.textContent = 'Confirmer'; } break;
      case 'group-leave': if (t.dataset.confirm) { const g = S.gid; watchGroup(null); S.sync.leaveGroup(g).catch(() => {}); toast('Vous avez quitté le groupe'); } else { t.dataset.confirm = '1'; t.textContent = 'Confirmer : quitter le groupe'; } break;
      case 'claim': { const key = t.dataset.key; const claimed = (S.me && S.me.claimed) || []; if (!claimed.includes(key)) { S.sync.saveMe({ claimed: [...claimed, key] }).catch(() => {}); celebrate(Game.CHALLENGE_PTS, 'Défi réussi en équipe !'); } } break;
      case 'treasure-hide': openHideTreasure(); break;
      case 'treasure-open': { const tr = S.treasures.find(x => x.id === id); if (tr) openTreasure(tr); } break;
      case 'tr-del': if (t.dataset.confirm) { S.sync.deleteTreasure(S.gid, id).catch(() => {}); closeModal(); } else { t.dataset.confirm = '1'; t.textContent = 'Confirmer'; } break;
      case 'feed-find': { const f = S.groupFinds.find(x => x.id === id); if (f) openFind(f, f.uid === S.uid); } break;
      case 'feed-carnet': { const c = S.carnets.find(x => x.id === id); if (c) showSortie(c); } break;
      case 'species': openSpecies(id); break;
      case 'myfind': { const f = S.myFinds.find(x => x.id === id); if (f) openFind(f, true); } break;
      case 'sortie-show': { const s = S.mySorties.find(x => x.id === id); if (s) showSortie(s); } break;
      case 'edit-avatar': openAvatarEditor(); break;
      case 'ob-start': startOnboarding(); break;
      case 'ev-center': closeModal(); openTab('carte'); M.map.setView([+t.dataset.lat, +t.dataset.lng], 16); break;
      case 'route-point': if (S.point) startRoute({ lat: S.point.lat, lng: S.point.lng, name: S.point.commune ? 'ce point (' + S.point.commune + ')' : 'ce point', kind: 'point' }); break;
      case 'route-find': { const own = t.dataset.own === '1', f = (own ? S.myFinds : S.groupFinds).find(x => x.id === id); if (f) startRoute({ lat: f.lat, lng: f.lng, name: ((Game.SPECIES_BY_ID[f.species] || {}).n || 'la trouvaille') + (own ? '' : ' de ' + (f.name || 'ton ami')), kind: 'find' }); } break;
      case 'route-friend': { const p = S.presence.find(x => x.id === t.dataset.uid), m = S.members.find(x => x.id === t.dataset.uid) || {}; if (p && p.lat) startRoute({ lat: p.lat, lng: p.lng, name: m.name || p.name || 'ton ami', kind: 'friend', uid: p.id }); } break;
      case 'route-event': startRoute({ lat: +t.dataset.lat, lng: +t.dataset.lng, name: t.dataset.name || 'l\'alerte', kind: 'event' }); break;
      case 'route-car': if (S.sortie && S.sortie.car) startRoute({ lat: S.sortie.car.lat, lng: S.sortie.car.lng, name: 'la voiture', kind: 'car' }); break;
      case 'route-zone': { const tr = S.treasures.find(x => x.id === id); if (tr) startRoute({ lat: tr.zoneLat, lng: tr.zoneLng, name: 'la zone du cèpe d\'or', kind: 'zone' }); } break;
    }
  });
  $('#handle').addEventListener('click', () => setSheet(S.sheet === 'open' ? 'peek' : 'open'));
  $('#peek').addEventListener('click', e => { if (!e.target.closest('button')) setSheet(S.sheet === 'open' ? 'peek' : 'open'); });
  $('#mode-pot').addEventListener('click', () => setMode('pot'));
  $('#mode-bio').addEventListener('click', () => setMode('bio'));
  $('#btn-menu').addEventListener('click', () => openDrawer(true));
  $('#btn-close').addEventListener('click', () => openDrawer(false));
  $('#scrim').addEventListener('click', () => openDrawer(false));
  $('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else if (!$('#drawer').hidden) openDrawer(false); } });
  $('#zin').addEventListener('click', () => M.map.zoomIn());
  $('#zout').addEventListener('click', () => M.map.zoomOut());
  $('#locate').addEventListener('click', locateToggle);
  $('#btn-find').addEventListener('click', () => openNewFind());
  $('#sb-car').addEventListener('click', openCompass);
  $('#sb-alert').addEventListener('click', openAlertMenu);
  $('#sb-end').addEventListener('click', openEndSortie);
  $('#sb-pocket').addEventListener('click', pocketEnter);
  $('#rb-stop').addEventListener('click', stopRoute);
  $('#rb-fit').addEventListener('click', fitRoute);
  $('#rb-pocket').addEventListener('click', pocketEnter);
  wirePocket();
  $('#q').addEventListener('input', e => search(e.target.value));
  document.querySelectorAll('input[name="base"]').forEach(r => { r.checked = r.value === S.base; r.addEventListener('change', e => { S.base = e.target.value; store.set('cc.base', S.base); M.setBase(S.base); }); });
  $('#lyr-low').checked = !!S.showLow;
  $('#lyr-low').addEventListener('change', e => { S.showLow = e.target.checked; store.set('cc.low', S.showLow); M.setShowLow(S.showLow); renderLegend(); });
  $('#lyr-soil').addEventListener('change', e => { M.setSoil(e.target.checked); renderLegend(); });
  $('#lyr-geol').addEventListener('change', e => M.setGeol(e.target.checked));
  $('#lyr-onf').addEventListener('change', e => M.setOnf(e.target.checked));
  $('#lyr-fog').addEventListener('change', renderTracksAndFog);
  $('#lyr-tracks').addEventListener('change', renderTracksAndFog);
  $('#dl-zone').addEventListener('click', downloadZone);
  $('#dl-clear').addEventListener('click', async () => { try { await caches.delete('cc-tiles'); await caches.delete('cc-data'); await caches.delete('cc-geol'); $('#dl-status').textContent = 'Cache vidé.'; } catch (e) { $('#dl-status').textContent = 'Impossible de vider le cache.'; } });
  $('#diag-copy').addEventListener('click', () => {
    const txt = 'Coins à champi — diagnostic\n' + navigator.userAgent + '\nSynchro : ' + (S.sync ? S.sync.kind : 'non connectée') + '\nSource forêts : ' + JSON.stringify(store.get('cc.src', null)) + '\n' + logs.join('\n');
    try { navigator.clipboard.writeText(txt).then(() => toast('Diagnostic copié'), () => toast('Copie impossible : sélectionnez le texte')); } catch (e) { toast('Copie impossible : sélectionnez le texte'); }
  });
  $('#diag-retry').addEventListener('click', () => { M.resetSource(); toast('Nouvel essai de chargement'); });
  $('#massifs').innerHTML = MASSIFS.map((m, i) => '<button class="btn small" data-act="gomassif" data-i="' + i + '">' + esc(m[0]) + '</button>').join('');
  window.addEventListener('resize', () => placeFabs());
  // Bouton « Sortie » dans la feuille du bas
  const peekRow = document.querySelector('.peek-row');
  const go = document.createElement('button'); go.className = 'btn small forest'; go.id = 'btn-sortie'; go.textContent = 'Sortie'; go.style.flex = 'none';
  go.addEventListener('click', e => { e.stopPropagation(); openStartSortie(); });
  peekRow.appendChild(go);
}
async function shareInvite() {
  const url = IN_APP ? SITE_URL : location.origin + location.pathname;
  const text = 'Rejoins mon groupe « ' + ((S.group && S.group.name) || 'Coins à champi') + ' » sur Coins à champi : ' + url + ' — code ' + S.gid + '. Sur Android, l\'appli garde ta position écran éteint : ' + APK_URL;
  if (NativeApp && await NativeApp.share('Coins à champi', text)) return;
  try { if (navigator.share) { await navigator.share({ title: 'Coins à champi', text }); return; } } catch (e) { /* annulé */ }
  try { await navigator.clipboard.writeText(text); toast('Invitation copiée : collez-la dans un message.'); } catch (e) { toast('Code du groupe : ' + S.gid, 6000); }
}

window.addEventListener('beforeunload', () => { if (S.sortie) saveSortieState(); });
boot().catch(e => { log('Démarrage : ' + e.message); console.error(e); });
window.CC = { S, get M() { return M; }, Game, C, logs, learn };
