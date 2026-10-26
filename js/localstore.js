// Base de données locale qui imite le sous-ensemble de l'API Firestore utilisé par l'appli.
// Sert au mode solo (sans Firebase) : données gardées sur l'appareil (IndexedDB), synchronisées entre onglets.

const SENT = '__sentinel__';
const store = new Map();
const listeners = new Set();
let idb = null, bc = null, ready = null;

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const parentOf = p => p.split('/').slice(0, -1).join('/');
function autoId() {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = ''; const r = crypto.getRandomValues(new Uint8Array(20)); for (const v of r) s += a[v % a.length]; return s;
}

function openIDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('coins-champi-local', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
function loadAll() {
  return new Promise((res, rej) => {
    const tx = idb.transaction('docs', 'readonly'), os = tx.objectStore('docs');
    const req = os.openCursor();
    req.onsuccess = () => { const c = req.result; if (c) { store.set(c.key, c.value); c.continue(); } else res(); };
    req.onerror = () => rej(req.error);
  });
}
// Écritures regroupées : une seule transaction pour toutes les écritures d'un même instant
let pending = null;
function persist(path, data) {
  if (!idb) return;
  if (!pending) { pending = new Map(); setTimeout(flush, 0); }
  pending.set(path, data);
}
function flush() {
  const m = pending; pending = null;
  if (!m || !idb) return;
  try {
    // durabilité « relaxed » : pas d'attente d'écriture disque à chaque transaction
    const tx = idb.transaction('docs', 'readwrite', { durability: 'relaxed' }), os = tx.objectStore('docs');
    for (const [p, d] of m) { if (d === undefined) os.delete(p); else os.put(d, p); }
  } catch (e) { /* stockage plein ou indisponible */ }
}

export function openLocal() {
  if (!ready) ready = (async () => {
    try { idb = await openIDB(); await loadAll(); addEventListener('pagehide', flush); } catch (e) { idb = null; }
    try { bc = new BroadcastChannel('coins-champi-local'); bc.onmessage = e => { const m = e.data || {}; if (m.path) write(m.path, m.data === null ? undefined : m.data, true); }; } catch (e) { bc = null; }
    return { kind: 'local' };
  })();
  return ready;
}

class DocRef { constructor(path) { this.type = 'document'; this.path = path; this.id = path.split('/').pop(); } }
class ColRef { constructor(path) { this.type = 'collection'; this.path = path; this.id = path.split('/').pop(); } }
class Query { constructor(col, cons) { this.type = 'query'; this.path = col.path; this.cons = cons || []; } }

export function doc(base, ...segs) {
  if (base && base.type === 'collection') return new DocRef(base.path + '/' + (segs.length ? segs.join('/') : autoId()));
  return new DocRef(segs.join('/'));
}
export function collection(base, ...segs) { return new ColRef(segs.join('/')); }
export function query(col, ...cons) { return new Query(col, cons); }
export const where = (f, op, v) => ({ k: 'where', f, op, v });
export const orderBy = (f, dir) => ({ k: 'orderBy', f, dir: dir || 'asc' });
export const limit = n => ({ k: 'limit', n });
export const increment = n => ({ [SENT]: 'inc', n });
export const arrayUnion = (...v) => ({ [SENT]: 'union', v });
export const serverTimestamp = () => ({ [SENT]: 'ts' });

function cmp(a, op, b) {
  switch (op) {
    case '==': return a === b; case '!=': return a !== b; case '<': return a < b; case '<=': return a <= b;
    case '>': return a > b; case '>=': return a >= b; case 'in': return Array.isArray(b) && b.includes(a);
    case 'array-contains': return Array.isArray(a) && a.includes(b); default: return false;
  }
}
function runQuery(q) {
  const prefix = q.path + '/';
  let rows = [];
  for (const [p, d] of store) if (p.startsWith(prefix) && !p.slice(prefix.length).includes('/')) rows.push({ id: p.slice(prefix.length), data: d });
  for (const c of q.cons) if (c.k === 'where') rows = rows.filter(r => cmp(r.data[c.f], c.op, c.v));
  const obs = q.cons.filter(c => c.k === 'orderBy');
  if (obs.length) {
    rows = rows.filter(r => obs.every(o => r.data[o.f] !== undefined));
    rows.sort((x, y) => { for (const o of obs) { const a = x.data[o.f], b = y.data[o.f]; if (a < b) return o.dir === 'desc' ? 1 : -1; if (a > b) return o.dir === 'desc' ? -1 : 1; } return 0; });
  }
  const lim = q.cons.find(c => c.k === 'limit');
  if (lim) rows = rows.slice(0, lim.n);
  return rows;
}
const docSnap = path => { const d = store.get(path); return { id: path.split('/').pop(), ref: new DocRef(path), exists: () => d !== undefined, data: () => clone(d), metadata: { fromCache: false, hasPendingWrites: false } }; };
const querySnap = q => { const rows = runQuery(q); return { docs: rows.map(r => ({ id: r.id, data: () => clone(r.data), exists: () => true })), size: rows.length, empty: !rows.length, metadata: { fromCache: false } }; };

function resolve(prev, data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v && typeof v === 'object' && v[SENT]) {
      const p = prev ? prev[k] : undefined;
      out[k] = v[SENT] === 'inc' ? (typeof p === 'number' ? p : 0) + v.n : v[SENT] === 'union' ? [...new Set([...(Array.isArray(p) ? p : []), ...v.v])] : Date.now();
    } else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = resolve(prev && typeof prev[k] === 'object' ? prev[k] : undefined, v);
    else out[k] = v;
  }
  return out;
}
function deepMerge(a, b) {
  const out = Object.assign({}, a);
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) && a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? deepMerge(a[k], v) : v;
  return out;
}
function write(path, data, remote) {
  if (data === undefined) store.delete(path); else store.set(path, data);
  if (!remote) { persist(path, data); if (bc) try { bc.postMessage({ path, data: data === undefined ? null : data }); } catch (e) { /* ignore */ } }
  const parent = parentOf(path);
  for (const l of listeners) if ((l.kind === 'doc' && l.path === path) || (l.kind === 'query' && l.q.path === parent)) l.schedule();
}
function applySet(ref, data, opts) { const prev = store.get(ref.path); write(ref.path, opts && opts.merge ? deepMerge(prev || {}, resolve(prev, data)) : resolve(undefined, data)); }
function applyUpdate(ref, patch) {
  const prev = store.get(ref.path);
  if (prev === undefined) { const e = new Error('Document absent : ' + ref.path); e.code = 'not-found'; throw e; }
  write(ref.path, deepMerge(prev, resolve(prev, patch)));
}
export async function setDoc(ref, data, opts) { applySet(ref, data, opts); }
export async function updateDoc(ref, patch) { applyUpdate(ref, patch); }
export async function deleteDoc(ref) { write(ref.path, undefined); }
export async function getDoc(ref) { return docSnap(ref.path); }
export async function getDocs(q) { return querySnap(q.type === 'query' ? q : new Query(q, [])); }

export function onSnapshot(target, next, error) {
  const l = { t: null, schedule() { if (this.t) return; this.t = setTimeout(() => { this.t = null; if (listeners.has(l)) this.fire(); }, 0); } };
  if (target.type === 'document') { l.kind = 'doc'; l.path = target.path; l.fire = () => next(docSnap(target.path)); }
  else { l.kind = 'query'; l.q = target.type === 'query' ? target : new Query(target, []); l.fire = () => next(querySnap(l.q)); }
  listeners.add(l); l.schedule();
  return () => { listeners.delete(l); if (l.t) clearTimeout(l.t); };
}
export async function runTransaction(db, fn) {
  const ops = [];
  const tx = { get: async ref => docSnap(ref.path), set(ref, d, o) { ops.push(() => applySet(ref, d, o)); return tx; }, update(ref, p) { ops.push(() => applyUpdate(ref, p)); return tx; }, delete(ref) { ops.push(() => write(ref.path, undefined)); return tx; } };
  const r = await fn(tx);
  ops.forEach(op => op());
  return r;
}
export function writeBatch() {
  const ops = [];
  const b = { set(ref, d, o) { ops.push(() => applySet(ref, d, o)); return b; }, update(ref, p) { ops.push(() => applyUpdate(ref, p)); return b; }, delete(ref) { ops.push(() => write(ref.path, undefined)); return b; }, async commit() { ops.forEach(op => op()); } };
  return b;
}
