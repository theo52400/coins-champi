// Appli Android (Capacitor) : ce module n'est chargé que dans l'appli, jamais sur le site.
// - suivi de position qui continue écran éteint pendant les sorties (service de premier plan + notification) ;
// - envoi de la position et lecture des alertes du groupe par le réseau du téléphone quand l'appli est en
//   arrière-plan (Android ralentit le réseau de la page au bout de quelques minutes) ;
// - alertes du groupe en notification ; partage d'invitation ; nouvelle version de l'appli.
import { Capacitor, CapacitorHttp, registerPlugin } from '../vendor/capacitor-core.js';

const BG = registerPlugin('BackgroundGeolocation');
const Alertes = registerPlugin('Alertes');   // module maison de l'appli (AlertesPlugin.java)
const ShareP = registerPlugin('Share');
const FS = 'https://firestore.googleapis.com/v1/projects/';
export const APK_URL = 'https://github.com/theo52400/coins-champi/releases/latest/download/coins-a-champi.apk';
const RELEASES = 'https://api.github.com/repos/theo52400/coins-champi/releases?per_page=10';

export const isNative = () => !!(Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());

// ---------- suivi de position ----------
let watcherId = null, starting = null, notifAsked = false;
async function askNotifications() {
  if (notifAsked) return;
  notifAsked = true;
  try { await Alertes.autoriser(); } catch (e) { /* notifications indisponibles : le suivi marche quand même */ }
}
// onPos reçoit un objet au format de navigator.geolocation ; onErr reçoit { code, message }
export function startTracking(onPos, onErr) {
  if (watcherId) return Promise.resolve(watcherId);
  if (starting) return starting;
  starting = (async () => {
    await askNotifications();
    const id = await BG.addWatcher({
      backgroundTitle: 'Coins à champi : sortie en cours',
      backgroundMessage: 'Ta position reste suivie écran éteint. Touche ici pour revenir à la carte.',
      requestPermissions: true, stale: false, distanceFilter: 3
    }, (loc, err) => {
      if (err) { onErr(err); return; }
      if (!loc) return;
      onPos({ coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, altitude: loc.altitude, heading: loc.bearing, speed: loc.speed }, timestamp: loc.time || Date.now(), native: true });
    });
    watcherId = id;
    return id;
  })().finally(() => { starting = null; });
  return starting;
}
export async function stopTracking() {
  const id = watcherId || (starting ? await starting.catch(() => null) : null);
  watcherId = null;
  if (id) await BG.removeWatcher({ id }).catch(() => {});
}
export const tracking = () => !!(watcherId || starting);
export const openSettings = () => BG.openSettings().catch(() => {});

// ---------- Firestore par le réseau du téléphone ----------
const enc = v => {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: encFields(v) } };
};
const encFields = o => { const f = {}; for (const [k, x] of Object.entries(o)) if (x !== undefined) f[k] = enc(x); return f; };
const dec = f => {
  if (!f) return null;
  if ('stringValue' in f) return f.stringValue;
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('booleanValue' in f) return f.booleanValue;
  if ('timestampValue' in f) return Date.parse(f.timestampValue);
  if ('mapValue' in f) return decFields(f.mapValue.fields || {});
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(dec);
  return null;
};
const decFields = fs => { const o = {}; for (const [k, x] of Object.entries(fs)) o[k] = dec(x); return o; };

// Jeton d'accès du joueur : renouvelé par le réseau du téléphone (celui de la page est ralenti en arrière-plan)
let tok = null;
async function idToken(user, apiKey) {
  if (tok && tok.uid === user.uid && tok.exp - Date.now() > 300000) return tok.id;
  try {
    const r = await CapacitorHttp.request({ method: 'POST', url: 'https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(apiKey), headers: { 'Content-Type': 'application/json' }, data: { grant_type: 'refresh_token', refresh_token: user.refreshToken }, connectTimeout: 15000, readTimeout: 15000 });
    const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    if (r.status === 200 && d && d.id_token) { tok = { uid: user.uid, id: d.id_token, exp: Date.now() + (Number(d.expires_in) || 3600) * 1000 }; return tok.id; }
  } catch (e) { /* on essaie avec le module Firebase */ }
  const id = await user.getIdToken();
  tok = { uid: user.uid, id, exp: Date.now() + 50 * 60000 };
  return id;
}
// Prépare le jeton avant de passer en arrière-plan
export function warmToken(ctx) { if (ctx && ctx.user) idToken(ctx.user, ctx.apiKey).catch(() => {}); }

// ctx : { projectId, apiKey, user } ; écrit les champs donnés dans groups/{gid}/presence/{uid} (fusion)
export async function writePresence(ctx, gid, data) {
  const t = await idToken(ctx.user, ctx.apiKey);
  const keys = Object.keys(data).filter(k => data[k] !== undefined);
  const root = 'projects/' + ctx.projectId + '/databases/(default)/documents';
  // « commit » en POST : mise à jour des seuls champs donnés, comme setDoc(..., { merge: true })
  const body = { writes: [{ update: { name: root + '/groups/' + gid + '/presence/' + ctx.user.uid, fields: encFields(data) }, updateMask: { fieldPaths: keys } }] };
  const r = await CapacitorHttp.request({ method: 'POST', url: 'https://firestore.googleapis.com/v1/' + root + ':commit', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, data: body, connectTimeout: 15000, readTimeout: 15000 });
  if (r.status < 200 || r.status >= 300) throw new Error('position : HTTP ' + r.status);
  return true;
}
// Alertes du groupe plus récentes que « since » (ms)
export async function eventsSince(ctx, gid, since) {
  const t = await idToken(ctx.user, ctx.apiKey);
  const url = FS + ctx.projectId + '/databases/(default)/documents/groups/' + encodeURIComponent(gid) + ':runQuery';
  const q = { structuredQuery: { from: [{ collectionId: 'events' }], where: { fieldFilter: { field: { fieldPath: 'ts' }, op: 'GREATER_THAN', value: { integerValue: String(Math.floor(since)) } } }, orderBy: [{ field: { fieldPath: 'ts' }, direction: 'ASCENDING' }], limit: 10 } };
  const r = await CapacitorHttp.request({ method: 'POST', url, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, data: q, connectTimeout: 15000, readTimeout: 15000 });
  if (r.status !== 200) throw new Error('alertes : HTTP ' + r.status);
  const rows = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return (Array.isArray(rows) ? rows : []).filter(x => x.document).map(x => Object.assign({ id: x.document.name.split('/').pop() }, decFields(x.document.fields || {})));
}

// ---------- notifications ----------
let notifId = Math.floor(Date.now() / 1000) % 100000;
export async function notify(title, body) {
  try { await Alertes.afficher({ id: ++notifId, title, body }); return true; }
  catch (e) { return false; }
}

// ---------- partage ----------
export async function share(title, text) {
  try { await ShareP.share({ title, text, dialogTitle: title }); return true; }
  catch (e) { return /cancel/i.test((e && e.message) || ''); }
}

// ---------- nouvelle version de l'appli ----------
export async function newerApp() {
  let cur = 0;
  try { cur = (await (await fetch('app-version.json', { cache: 'no-store' })).json()).build || 0; } catch (e) { return null; }
  try {
    const r = await fetch(RELEASES, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) return null;
    const best = (await r.json()).map(x => { const m = /^android-v(\d+)$/.exec(String(x.tag_name || '')); return m && !x.draft && !x.prerelease ? { n: +m[1], name: x.name } : null; }).filter(Boolean).sort((a, b) => b.n - a.n)[0];
    return best && cur && best.n > cur ? best : null;
  } catch (e) { return null; }
}
