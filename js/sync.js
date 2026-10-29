// Synchronisation : profils, groupes, positions, trouvailles, photos, alertes, trésors, carnets.
// Même code pour Firebase (Firestore) et pour la base locale du mode solo, qui imite la même API.
import { groupCode } from './game.js';

export function clean(v) {
  if (Array.isArray(v)) return v.map(clean).filter(x => x !== undefined);
  if (v && typeof v === 'object') {
    const proto = Object.getPrototypeOf(v);
    if ((proto !== Object.prototype && proto !== null) || Object.keys(v).some(k => k.startsWith('__'))) return v;
    const o = {};
    for (const [k, x] of Object.entries(v)) { const c = clean(x); if (c !== undefined && !(typeof c === 'number' && !isFinite(c))) o[k] = c; }
    return o;
  }
  return v;
}

export class Sync {
  constructor(api, db, uid, kind) { this.api = api; this.db = db; this.uid = uid; this.kind = kind; this.onError = null; }
  _d(...p) { return this.api.doc(this.db, ...p); }
  _c(...p) { return this.api.collection(this.db, ...p); }
  _w(promise, what) { return promise.catch(e => { if (this.onError) this.onError(what, e); throw e; }); }
  _on(target, cb, what) { return this.api.onSnapshot(target, cb, e => { if (this.onError) this.onError(what, e); }); }
  _list(s) { return s.docs.map(d => Object.assign({ id: d.id }, d.data())); }

  // ---- profil ----
  watchMe(cb) { return this._on(this._d('users', this.uid), s => cb(s.exists() ? s.data() : null, s.metadata || {}), 'profil'); }
  saveMe(patch) { return this._w(this.api.setDoc(this._d('users', this.uid), clean(patch), { merge: true }), 'profil'); }

  // ---- compte : e-mail et mot de passe, pour retrouver son champignon sur un autre téléphone ou dans l'appli ----
  // Le joueur commence avec un compte anonyme lié à l'appareil ; « protéger » ajoute un e-mail et un mot de passe
  // à ce même compte (même identifiant : profil, trouvailles et groupe sont gardés).
  get account() {
    const u = this.auth && this.auth.currentUser;
    return u ? { anonymous: u.isAnonymous, email: u.email || null, uid: u.uid } : null;
  }
  async protect(email, password) {
    const cred = this.api.EmailAuthProvider.credential(email, password);
    await this.api.linkWithCredential(this.auth.currentUser, cred);
    return this.account;
  }
  login(email, password) { return this.api.signInWithEmailAndPassword(this.auth, email, password); }
  resetPassword(email) { return this.api.sendPasswordResetEmail(this.auth, email); }
  logout() { return this.api.signOut(this.auth); }

  // ---- groupes (l'identifiant du groupe est son code d'invitation) ----
  async createGroup(name, member) {
    const gid = groupCode();
    await this._retryAuth(() => this._w(this.api.setDoc(this._d('groups', gid), clean({ name, owner: this.uid, ts: Date.now() })), 'création du groupe'));
    await this.joinGroup(gid, member);
    return gid;
  }
  async joinGroup(gid, member) {
    return this._retryAuth(async () => {
      const g = await this._w(this.api.getDoc(this._d('groups', gid)), 'groupe');
      if (!g.exists()) { const e = new Error('Aucun groupe ne porte ce code.'); e.code = 'not-found'; throw e; }
      await this._w(this.api.setDoc(this._d('groups', gid, 'members', this.uid), clean(Object.assign({ joinedAt: Date.now() }, member)), { merge: true }), 'adhésion');
      return Object.assign({ id: gid }, g.data());
    });
  }
  // Le compte de ce navigateur est-il toujours accepté par le serveur ? (jeton renouvelé)
  async authOk() {
    if (this.kind !== 'firebase' || !this.auth) return true;
    const u = this.auth.currentUser;
    if (!u || u.uid !== this.uid) return false;
    try { await u.getIdToken(true); return true; } catch (e) { return !/user-token-expired|user-not-found|user-disabled|invalid-user-token|token-expired/.test((e && e.code) || ''); }
  }
  // « accès refusé » : souvent un jeton périmé ; on le renouvelle et on réessaie une fois, sinon compte perdu
  async _retryAuth(fn) {
    try { return await fn(); } catch (e) {
      if (!/permission|unauthenticated/i.test(((e && e.code) || '') + ' ' + ((e && e.message) || ''))) throw e;
      if (!(await this.authOk())) { const x = new Error('Connexion au jeu expirée sur ce téléphone.'); x.code = 'auth-lost'; throw x; }
      return fn();
    }
  }
  async leaveGroup(gid) {
    try { await this.api.deleteDoc(this._d('groups', gid, 'presence', this.uid)); } catch (e) { /* pas de position enregistrée */ }
    await this._w(this.api.deleteDoc(this._d('groups', gid, 'members', this.uid)), 'départ du groupe');
  }
  watchGroup(gid, cb) { return this._on(this._d('groups', gid), s => cb(s.exists() ? Object.assign({ id: gid }, s.data()) : null, s.metadata || {}), 'groupe'); }
  watchMembers(gid, cb) { return this._on(this._c('groups', gid, 'members'), s => cb(this._list(s)), 'membres'); }
  // le créateur du groupe peut en retirer un membre (règle Firestore : propriétaire du groupe)
  removeMember(gid, uid) { return this._w(this.api.deleteDoc(this._d('groups', gid, 'members', uid)), 'retrait d\'un membre'); }
  updateMember(gid, patch) { return this._w(this.api.setDoc(this._d('groups', gid, 'members', this.uid), clean(patch), { merge: true }), 'membre'); }

  // ---- positions en direct ----
  setPresence(gid, p) { return this._w(this.api.setDoc(this._d('groups', gid, 'presence', this.uid), clean(p), { merge: true }), 'position'); }
  watchPresence(gid, cb) { return this._on(this._c('groups', gid, 'presence'), s => cb(this._list(s)), 'positions'); }

  // ---- trouvailles ----
  // find : fiche complète (position précise). photo : JPEG en base64 ou null. gid : groupe si partagée.
  saveFind(find, photo, gid, pub) {
    const shared = !!(gid && pub);
    const b = this.api.writeBatch(this.db);
    const priv = clean(Object.assign({}, find, { hasPhoto: !!(photo || find.hasPhoto), gid: shared ? gid : null, photoAt: photo ? (shared ? 'group' : 'user') : (find.photoAt || null) }));
    b.set(this._d('users', this.uid, 'finds', find.id), priv);
    if (photo) {
      if (shared) b.set(this._d('groups', gid, 'photos', find.id), { uid: this.uid, data: photo });
      else b.set(this._d('users', this.uid, 'photos', find.id), { data: photo });
    }
    if (shared) b.set(this._d('groups', gid, 'finds', find.id), clean(Object.assign({ likedBy: [] }, pub, { uid: this.uid })));
    return this._w(b.commit(), 'trouvaille');
  }
  deleteFind(find) {
    const b = this.api.writeBatch(this.db);
    b.delete(this._d('users', this.uid, 'finds', find.id));
    if (find.photoAt === 'user') b.delete(this._d('users', this.uid, 'photos', find.id));
    if (find.gid) {
      b.delete(this._d('groups', find.gid, 'finds', find.id));
      if (find.photoAt === 'group') b.delete(this._d('groups', find.gid, 'photos', find.id));
    }
    return this._w(b.commit(), 'suppression');
  }
  watchMyFinds(cb) { return this._on(this.api.query(this._c('users', this.uid, 'finds'), this.api.orderBy('ts', 'desc'), this.api.limit(2000)), s => cb(this._list(s)), 'mes trouvailles'); }
  watchGroupFinds(gid, cb) { return this._on(this.api.query(this._c('groups', gid, 'finds'), this.api.orderBy('ts', 'desc'), this.api.limit(500)), s => cb(this._list(s)), 'trouvailles du groupe'); }
  async getPhoto(find, gid) {
    const ref = find.photoAt === 'group' || (gid && !find.photoAt) ? this._d('groups', find.gid || gid, 'photos', find.id) : this._d('users', this.uid, 'photos', find.id);
    const s = await this.api.getDoc(ref);
    return s.exists() ? s.data().data : null;
  }
  like(gid, fid) { return this._w(this.api.updateDoc(this._d('groups', gid, 'finds', fid), { likedBy: this.api.arrayUnion(this.uid) }), 'bravo'); }

  // ---- alertes (Venez voir, regroupement, SOS) ----
  sendEvent(gid, ev) { return this._w(this.api.setDoc(this.api.doc(this._c('groups', gid, 'events')), clean(Object.assign({}, ev, { uid: this.uid, ts: Date.now() }))), 'alerte'); }
  watchEvents(gid, since, cb) { return this._on(this.api.query(this._c('groups', gid, 'events'), this.api.where('ts', '>=', since), this.api.orderBy('ts', 'desc'), this.api.limit(40)), s => cb(this._list(s)), 'alertes'); }

  // ---- cèpes d'or (trésors cachés) ----
  hideTreasure(gid, t) { return this._w(this.api.setDoc(this._d('groups', gid, 'challenges', t.id), clean(Object.assign({ type: 'treasure', ts: Date.now() }, t, { createdBy: this.uid }))), 'trésor'); }
  watchTreasures(gid, cb) { return this._on(this.api.query(this._c('groups', gid, 'challenges'), this.api.orderBy('ts', 'desc'), this.api.limit(30)), s => cb(this._list(s)), 'trésors'); }
  claimTreasure(gid, cid, name) {
    const ref = this._d('groups', gid, 'challenges', cid);
    return this._w(this.api.runTransaction(this.db, async tx => {
      const s = await tx.get(ref);
      if (!s.exists()) throw Object.assign(new Error('Ce trésor n\'existe plus.'), { code: 'not-found' });
      const d = s.data();
      if (d.foundBy) throw Object.assign(new Error((d.foundByName || 'Quelqu\'un') + ' l\'a déjà trouvé.'), { code: 'taken' });
      tx.update(ref, { foundBy: this.uid, foundByName: name || '', foundAt: Date.now() });
      return d;
    }), 'trésor');
  }
  deleteTreasure(gid, cid) { return this._w(this.api.deleteDoc(this._d('groups', gid, 'challenges', cid)), 'trésor'); }

  // ---- sorties et carnets ----
  // pub : version partagée au groupe (sans les coins secrets), ou null
  saveSortie(s, gid, pub) {
    const b = this.api.writeBatch(this.db);
    b.set(this._d('users', this.uid, 'sorties', s.id), clean(Object.assign({}, s, { sharedTo: pub && gid ? gid : null })));
    if (pub && gid) b.set(this._d('groups', gid, 'carnets', s.id), clean(Object.assign({}, pub, { uid: this.uid })));
    return this._w(b.commit(), 'sortie');
  }
  watchMySorties(cb) { return this._on(this.api.query(this._c('users', this.uid, 'sorties'), this.api.orderBy('start', 'desc'), this.api.limit(500)), s => cb(this._list(s)), 'mes sorties'); }
  watchCarnets(gid, cb) { return this._on(this.api.query(this._c('groups', gid, 'carnets'), this.api.orderBy('start', 'desc'), this.api.limit(200)), s => cb(this._list(s)), 'carnets'); }
}

function localUid() {
  const q = new URLSearchParams(location.search).get('as');
  if (q) return 'local-' + q.replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
  try {
    let id = localStorage.getItem('cc.uid');
    if (!id) { id = 'local-' + Math.random().toString(36).slice(2, 12); localStorage.setItem('cc.uid', id); }
    return id;
  } catch (e) { return 'local-' + Math.random().toString(36).slice(2, 12); }
}

// L'appli Firebase n'est initialisée qu'une fois, même si la connexion doit être retentée
let fbInit = null;
function firebaseInit(config) {
  if (!fbInit) fbInit = (async () => {
    const fb = await import('../vendor/firebase.js');
    const app = fb.initializeApp(config);
    let db;
    try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); }
    catch (e) { db = fb.initializeFirestore(app, { localCache: fb.memoryLocalCache() }); }
    const auth = fb.getAuth(app);
    auth.languageCode = 'fr';   // e-mails de Firebase (mot de passe oublié) en français
    return { fb, db, auth };
  })().catch(e => { fbInit = null; throw e; });
  return fbInit;
}
export async function connect(config) {
  if (config && config.apiKey && config.projectId) {
    const { fb, db, auth } = await firebaseInit(config);
    // Compte anonyme : retrouvé sur l'appareil (même hors réseau), sinon créé
    const user = auth.currentUser || await new Promise((resolve, reject) => {
      let tried = false, un = null, done = false;
      const end = (f, v) => { if (done) return; done = true; clearTimeout(timer); if (un) un(); f(v); };
      const timer = setTimeout(() => end(reject, new Error('Connexion au serveur impossible : vérifiez le réseau.')), 25000);
      un = fb.onAuthStateChanged(auth, u => {
        if (u) end(resolve, u);
        else if (!tried) { tried = true; fb.signInAnonymously(auth).catch(e => end(reject, e)); }
      }, e => end(reject, e));
      if (done && un) un();
    });
    // Compte gardé par le navigateur mais refusé par le serveur (supprimé, désactivé, jeton périmé) : on repart
    // d'un compte anonyme neuf plutôt que d'essuyer des « accès refusé » partout
    let u = user;
    if (navigator.onLine !== false) {
      try { await Promise.race([u.getIdToken(true), new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('délai'), { code: 'timeout' })), 8000))]); }
      catch (e) {
        if (/user-token-expired|user-not-found|user-disabled|invalid-user-token|token-expired/.test((e && e.code) || '')) {
          try { await fb.signOut(auth); } catch (e2) { /* ignore */ }
          u = (await fb.signInAnonymously(auth)).user;
        }
      }
    }
    const sync = new Sync(fb, db, u.uid, 'firebase');
    sync.auth = auth; sync.config = config;   // pour l'appli Android : écrire en arrière-plan avec le jeton du compte anonyme
    return sync;
  }
  const L = await import('./localstore.js');
  const db = await L.openLocal();
  return new Sync(L, db, localUid(), 'local');
}
