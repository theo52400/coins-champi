// Vérification de l'appli publiée, en conditions réelles : Firebase, BD Forêt et fonds IGN, itinéraire piéton IGN,
// communes, météo, sous-sol. Lancé par .github/workflows/verif-live.yml ; écrit un rapport et des captures.
import { chromium } from 'playwright';
import fs from 'fs';

const SITE = process.env.SITE || 'https://theo52400.github.io/coins-champi/';
const OUT = process.argv[2] || 'verif';
fs.mkdirSync(OUT, { recursive: true });
const R = { site: SITE, date: new Date().toISOString(), checks: [], console: [], http: [], counts: {} };
const check = (name, ok, detail) => {
  R.checks.push({ name, ok: !!ok, detail });
  console.log((ok ? 'OK     ' : 'ÉCHEC  ') + name + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 400) : ''));
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const count = k => { R.counts[k] = (R.counts[k] || 0) + 1; };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR',
  geolocation: { latitude: 49.0400, longitude: 7.5200, accuracy: 10 }, permissions: ['geolocation'],
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
});
const page = await ctx.newPage();
page.on('console', m => R.console.push(m.type() + ' ' + m.text().slice(0, 300)));
page.on('pageerror', e => R.console.push('pageerror ' + e.message));
page.on('requestfailed', r => { const t = (r.failure() || {}).errorText || ''; if (!/ERR_ABORTED/.test(t)) R.http.push('ÉCHEC ' + r.url().slice(0, 160) + ' ' + t); });
page.on('response', r => {
  const u = r.url(), s = r.status();
  if (s >= 400) R.http.push(s + ' ' + u.slice(0, 160));
  if (s < 400) {
    if (/data\.geopf\.fr\/wmts/.test(u)) count('tuiles IGN');
    else if (/data\.geopf\.fr\/wfs/.test(u)) count('BD Forêt (WFS)');
    else if (/navigation\/itineraire/.test(u)) count('itinéraire IGN');
    else if (/altimetrie/.test(u)) count('altitude IGN');
    else if (/geo\.api\.gouv\.fr/.test(u)) count('communes');
    else if (/open-meteo/.test(u)) count('météo');
    else if (/data\/geol\//.test(u)) count('sous-sol');
    else if (/googleapis|firebase/.test(u)) count('Firebase');
  }
});
const shot = async n => { try { await page.screenshot({ path: OUT + '/' + n + '.png' }); } catch (e) { console.log('capture ' + n + ' : ' + e.message); } };
const wait = (fn, arg, t) => page.waitForFunction(fn, arg, { timeout: t || 20000, polling: 250 }).then(() => true, () => false);
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, 'exception : ' + e.message.split('\n')[0]); } };
const clickAt = async (lat, lng) => {
  const pt = await page.evaluate(d => { const p = CC.M.map.latLngToContainerPoint([d.lat, d.lng]); const r = document.getElementById('map').getBoundingClientRect(); return [p.x + r.left, p.y + r.top]; }, { lat, lng });
  await page.mouse.click(pt[0], pt[1]);
};

await step('Ouverture', async () => {
  await page.goto(SITE + '?as=verif', { waitUntil: 'load', timeout: 60000 });
  const ok = await wait(() => window.CC && CC.M && CC.M.map, null, 30000);
  const ver = await page.evaluate(() => fetch('sw.js', { cache: 'no-store' }).then(r => r.text()).then(t => (t.match(/VERSION = '([^']+)'/) || [])[1]).catch(() => null));
  check('L\'appli démarre', ok, { version: ver });
  await sleep(3000); await shot('1-ouverture');
});

await step('Firebase', async () => {
  const ok = await wait(() => CC.S.sync, null, 40000);
  const st = await page.evaluate(() => ({ kind: CC.S.sync && CC.S.sync.kind, uid: CC.S.uid && CC.S.uid.slice(0, 6), banner: document.getElementById('banner').hidden ? null : document.getElementById('banner').textContent.trim() }));
  check('Connexion au serveur du jeu (Firebase, compte anonyme)', ok && st.kind === 'firebase', st);
  if (!(ok && st.kind === 'firebase')) return;
  const w = await page.evaluate(async () => {
    const s = CC.S.sync, t0 = Date.now();
    try {
      await s.saveMe({ name: 'Vérification', verif: Date.now() });
      // setDoc ne se termine qu'une fois l'écriture acceptée par le serveur
      const back = await s.api.getDoc(s._d('users', s.uid)).then(d => d.exists() && d.data().name, e => 'lecture : ' + e.code);
      await s.api.deleteDoc(s._d('users', s.uid));
      return { ecriture: true, relu: back, ms: Date.now() - t0 };
    } catch (e) { return { ecriture: false, err: (e.code || '') + ' ' + e.message }; }
  });
  check('Écriture et relecture dans Firestore (puis effacement)', w.ecriture && w.relu === 'Vérification', w);
  await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.hidden = true; });
});

await step('Avatar', async () => {
  const ok = await wait(() => document.querySelector('.pm.me, .me-dot'), null, 15000);
  const what = await page.evaluate(() => (document.querySelector('.pm.me') ? 'avatar' : document.querySelector('.me-dot') ? 'point (pas encore de profil)' : null));
  check('Ma position s\'affiche sur la carte', ok, what);
});

await step('Sous-sol', async () => {
  const pts = [[49.06, 7.50, 'Vosges du Nord', 1], [48.66, 6.10, 'Forêt de Haye', 3], [48.95, 4.30, 'Champagne', 3], [44.20, -0.80, 'Landes', 1], [45.75, 1.70, 'Limousin', 1]];
  const res = [];
  for (const [lat, lon, nm, want] of pts) {
    await page.evaluate(d => CC.M.map.setView([d[0], d[1]], 11, { animate: false }), [lat, lon]);
    const got = await wait(d => CC.M.rockAt(d[0], d[1]), [lat, lon], 15000);
    const r = got ? await page.evaluate(d => CC.M.rockAt(d[0], d[1]), [lat, lon]) : null;
    res.push({ nm, want, got: r });
  }
  check('Sous-sol chargé et cohérent (grès, calcaire, craie, sables, granite)', res.every(x => x.got && x.got.c === x.want), res.map(x => x.nm + ' : ' + (x.got ? x.got.n + ' [' + x.got.c + ']' : '—')));
  await page.evaluate(() => CC.M.map.setView([49.05, 7.45], 10, { animate: false })); await sleep(2500); await shot('2-sous-sol');
});

await step('BD Forêt', async () => {
  await page.evaluate(() => CC.M.map.setView([49.0430, 7.5250], 15, { animate: false }));
  const ok = await wait(() => { const t = CC.M.tileCounts(); return t && t.ok > 0 && t.wait === 0 && CC.M.G; }, null, 45000);
  const st = await page.evaluate(() => ({ tuiles: CC.M.tileCounts(), peuplements: CC.M.feats.size, erreur: CC.M.st.srcErr }));
  check('Peuplements forestiers IGN chargés et grille de potentiel calculée', ok && st.peuplements > 0, st);
  await sleep(2000); await shot('3-foret');
});

await step('Point', async () => {
  // un vrai téléphone donne une position toutes les secondes ; le navigateur de test une seule fois : on la redonne
  await ctx.setGeolocation({ latitude: 49.0400, longitude: 7.5200, accuracy: 10 }); await sleep(800);
  await clickAt(49.0452, 7.5310);
  const ok = await wait(() => document.querySelector('[data-act="route-point"]'), null, 10000);
  // l'altitude de l'IGN arrive parfois après quelques secondes
  await wait(() => /Altitude\s*\n?\s*(\d|—)/.test((document.getElementById('sec-point') || {}).innerText || ''), null, 12000);
  const info = await page.evaluate(() => (document.getElementById('sec-point') || {}).innerText || '');
  check('Fiche d\'un point : peuplement, sol, sous-sol, commune, altitude', ok && /Sous-sol/.test(info) && /Altitude\s*\n?\s*\d/.test(info), info.replace(/\s+/g, ' ').slice(0, 300));
  await shot('4-point');
});

await step('Itinéraire', async () => {
  // ressources et profils offerts par le service, puis quelques variantes de requête
  R.routeCaps = await page.evaluate(async () => {
    try {
      const j = await (await fetch('https://data.geopf.fr/navigation/getcapabilities')).json();
      return (j.resources || []).map(r => ({ id: r.id, ops: (r.availableOperations || []).map(o => ({ id: o.id, params: (o.availableParameters || []).map(p => p.id + (p.values ? '=' + JSON.stringify(p.values).slice(0, 120) : p.defaultValue !== undefined ? '(' + p.defaultValue + ')' : '')) })) }));
    } catch (e) { return { err: e.message }; }
  });
  R.routeTries = await page.evaluate(async () => {
    const base = 'https://data.geopf.fr/navigation/itineraire?start=7.5200,49.0400&end=7.5310,49.0452';
    const out = [];
    for (const q of ['&resource=bdtopo-pgr&profile=pedestrian&optimization=shortest&geometryFormat=geojson', '&resource=bdtopo-valhalla&profile=pedestrian&optimization=shortest&geometryFormat=geojson']) {
      try { const r = await fetch(base + q); const t = await r.text(); let n = null; try { const j = JSON.parse(t); n = j.geometry && j.geometry.coordinates ? j.geometry.coordinates.length : null; } catch (e) { /* texte */ } out.push({ q, status: r.status, points: n, corps: n ? undefined : t.slice(0, 300) }); }
      catch (e) { out.push({ q, err: e.message }); }
    }
    return out;
  });
  console.log('Itinéraire, variantes :', JSON.stringify(R.routeTries).slice(0, 2000));
  const direct = await page.evaluate(async () => {
    const u = 'https://data.geopf.fr/navigation/itineraire?resource=bdtopo-pgr&profile=pedestrian&optimization=shortest&start=7.5200,49.0400&end=7.5310,49.0452&geometryFormat=geojson&getSteps=false&getBbox=false&distanceUnit=meter&timeUnit=second';
    try { const r = await fetch(u); const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) { /* texte */ } return { status: r.status, n: j.geometry && j.geometry.coordinates && j.geometry.coordinates.length, distance: j.distance, duration: j.duration, unite: j.distanceUnit, corps: r.ok ? undefined : t.slice(0, 400) }; }
    catch (e) { return { err: e.message }; }
  });
  check('Service d\'itinéraire piéton IGN joignable depuis le site (CORS)', direct.status === 200 && direct.n > 1, direct);
  await page.evaluate(() => document.querySelector('[data-act="route-point"]').click());
  const ok = await wait(() => !document.getElementById('route-bar').hidden && CC.M.layers.route.getLayers().length >= 5, null, 20000);
  const st = await page.evaluate(() => ({ dist: document.getElementById('rb-dist').textContent, sub: document.getElementById('rb-sub').textContent, calques: CC.M.layers.route.getLayers().length }));
  check('Itinéraire tracé dans l\'appli (chemin IGN + ligne directe)', ok, st);
  await sleep(1500); await shot('5-itineraire');
  await page.click('#rb-pocket'); await sleep(1200);
  const pk = await page.evaluate(() => ({ ouvert: !document.getElementById('pocket').hidden, grand: document.getElementById('pk-big').textContent, gps: document.getElementById('pk-gps').textContent }));
  check('Mode poche', pk.ouvert, pk);
  await shot('6-poche');
  const box = await page.evaluate(() => { const r = document.getElementById('pk-unlock').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await sleep(1500); await page.mouse.up(); await sleep(400);
  check('Mode poche : appui long pour sortir', await page.evaluate(() => document.getElementById('pocket').hidden));
  await page.click('#rb-stop').catch(() => {});
});

await step('Communes', async () => {
  const nm = await page.evaluate(() => CC.M.communeAt(49.04, 7.52, 8000));
  check('Commune au point (geo.api.gouv.fr)', typeof nm === 'string' && nm.length > 1, nm);
  R.communeSearch = await page.evaluate(async () => { try { return (await (await fetch('https://geo.api.gouv.fr/communes?nom=fontaineb&fields=nom,code,departement,population&boost=population&limit=8')).json()).map(c => c.nom + ' (' + (c.departement && c.departement.code) + ', ' + c.population + ' hab.)'); } catch (e) { return e.message; } });
  console.log('Communes « fontaineb » :', JSON.stringify(R.communeSearch));
  await page.click('#btn-menu'); await page.fill('#q', 'fontaineb');
  const ok = await wait(() => document.querySelector('#results [data-act="gocommune"]'), null, 10000);
  if (ok) await page.evaluate(() => document.querySelector('#results [data-act="gocommune"]').click());
  await sleep(2500);
  const c = await page.evaluate(() => CC.M.map.getCenter());
  check('Recherche d\'une commune : Fontainebleau', ok && Math.abs(c.lat - 48.40) < 0.15 && Math.abs(c.lng - 2.68) < 0.2, c);
  await shot('7-fontainebleau');
});

await step('Météo', async () => {
  const m = await page.evaluate(async () => {
    try { const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=48.40&longitude=2.70&daily=precipitation_sum,temperature_2m_mean&past_days=14&forecast_days=1&timezone=Europe%2FParis'); const j = await r.json(); return { status: r.status, jours: j.daily && j.daily.time.length }; }
    catch (e) { return { err: e.message }; }
  });
  check('Météo Open-Meteo', m.status === 200 && m.jours > 10, m);
});

// vue de loin : carte de France des coins (forêts précalculées) et météo de pousse du jour
await step('Vue de loin', async () => {
  await page.evaluate(() => { const m = document.getElementById('modal'); if (!m.hidden) document.querySelector('#modal [data-act="modal-close"]') && document.querySelector('#modal [data-act="modal-close"]').click(); CC.M.map.setView([46.6, 2.5], 6); });
  const ok = await wait(() => CC.M.far.state.coarse === 'ok' && CC.M.far.state.wxDate, null, 25000);
  const st = await page.evaluate(() => ({ etat: CC.M.far.state, bandeau: document.getElementById('status').textContent, today: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }) }));
  await sleep(1500); await shot('8-france');
  check('Vue de loin : carte de France des coins et météo de pousse', ok && /Ça pousse/.test(st.bandeau), st);
  const age = st.etat.wxDate ? (Date.parse(st.today) - Date.parse(st.etat.wxDate)) / 864e5 : 99;
  check('Météo de pousse à jour (moins de 2 jours)', age <= 2, { meteo: st.etat.wxDate, aujourdhui: st.today });
  await page.evaluate(() => CC.M.map.setView([49.02, 7.45], 11));
  const ok2 = await wait(() => CC.M.far.state.tiles >= 1 && !CC.M.far.state.wait, null, 20000);
  await sleep(1500); await shot('9-vosges-du-nord');
  const g = await page.evaluate(() => CC.M.far.groupAt(49.03, 7.47));
  check('Vue d\'ensemble en cases de 250 m (Vosges du Nord : forêt)', ok2 && !!g, { peuplement: g });
});

// discussion du groupe (règle Firestore « messages » publiée ?) : groupe de test, un message, relu puis effacé
await step('Discussion', async () => {
  const r = await page.evaluate(async () => {
    const S = CC.S.sync, out = {};
    let gid = null;
    try {
      gid = await S.createGroup('Vérification', { name: 'Vérification' });
      const id = await S.sendMessage(gid, { name: 'Vérification', text: 'Message de test' });
      const d = await S.api.getDoc(S._d('groups', gid, 'messages', id));
      out.relu = d.exists() && d.data().text === 'Message de test';
      await S.deleteMessage(gid, id); out.efface = true;
    } catch (e) { out.err = e.code || e.message; }
    try { if (gid) { await S.api.deleteDoc(S._d('groups', gid, 'members', S.uid)); await S.api.deleteDoc(S._d('groups', gid)); } } catch (e) { out.nettoyage = e.code; }
    return out;
  });
  check('Discussion du groupe : envoi, lecture, effacement' + (r.err && /permission/.test(r.err) ? ' (règles Firestore à publier)' : ''), r.relu && r.efface, r);
});

// encyclopédie : fiches et photos libres
await step('Encyclopédie', async () => {
  await page.evaluate(() => { CC.learn.openFiche('girolle'); document.querySelector('.tabs [data-tab="mycodex"]').click(); });
  const ok = await wait(() => { const i = document.querySelector('.en-carousel img'); return i && i.complete && i.naturalWidth > 100; }, null, 20000);
  const f = await page.evaluate(() => ({ titre: document.querySelector('.panel h2') && document.querySelector('.panel h2').textContent, photos: document.querySelectorAll('.en-carousel img').length, credit: document.querySelector('.en-carousel figcaption') && document.querySelector('.en-carousel figcaption').textContent }));
  await sleep(800); await shot('10-encyclopedie');
  check('Encyclopédie : fiche girolle avec photos libres et crédits', ok && f.titre === 'Girolle' && f.photos >= 2 && /Wikimedia/.test(f.credit || ''), f);
  await page.evaluate(() => document.querySelector('.tabs [data-tab="carte"]').click());
});

// comptes e-mail + mot de passe (fournisseur « Adresse e-mail/Mot de passe » de Firebase) : création à partir du compte
// anonyme, déconnexion, reconnexion : on doit retrouver le même joueur. Le compte de test est supprimé ensuite.
await step('Comptes', async () => {
  const r = await page.evaluate(async () => {
    const s = CC.S.sync; if (!s || s.kind !== 'firebase') return { protect: 'pas de connexion Firebase' };
    const uid0 = s.uid, email = 'verif-' + Date.now() + '@example.com', pw = 'Verif-' + Math.random().toString(36).slice(2, 12);
    try { await s.protect(email, pw); } catch (e) { return { protect: e.code || e.message }; }
    const linked = s.account;
    await s.logout();
    let uid1 = null;
    try { uid1 = (await s.login(email, pw)).user.uid; } catch (e) { return { protect: 'ok', login: e.code || e.message }; }
    let reset = 'non testé';
    try { await s.resetPassword(email); reset = 'ok'; } catch (e) { reset = e.code || e.message; }
    const t = await s.auth.currentUser.getIdToken();
    const d = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + s.config.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: t }) });
    return { protect: 'ok', sansCompteAvant: true, apresCreation: linked && !linked.anonymous ? 'compte e-mail' : 'toujours anonyme', memeJoueur: uid0 === uid1, motDePasseOublie: reset, suppression: d.ok ? 'ok' : 'HTTP ' + d.status };
  });
  const why = /operation-not-allowed|admin-restricted/.test(r.protect || '') ? ' (à activer : Firebase → Authentication → Méthode de connexion → Adresse e-mail/Mot de passe)' : '';
  check('Comptes e-mail : création, déconnexion, reconnexion au même joueur' + why, r.protect === 'ok' && r.memeJoueur && r.apresCreation === 'compte e-mail', r);
  R.compteDejaSupprime = r.suppression === 'ok';
});
R.logs = await page.evaluate(() => (window.CC && CC.logs ? CC.logs.slice(-80) : [])).catch(() => []);
// le compte anonyme créé par la vérification est supprimé de Firebase
R.compte = R.compteDejaSupprime ? 'supprimé (test des comptes)' : await page.evaluate(async () => {
  try { const s = CC.S.sync; if (!s || s.kind !== 'firebase') return 'pas de compte'; const t = await s.auth.currentUser.getIdToken(); const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + s.config.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: t }) }); return r.ok ? 'supprimé' : 'HTTP ' + r.status; } catch (e) { return e.message; }
}).catch(e => e.message);
console.log('Compte de vérification :', R.compte);
check('Aucune erreur JavaScript', !R.console.some(l => l.startsWith('pageerror')), R.console.filter(l => l.startsWith('pageerror')));
const okN = R.checks.filter(c => c.ok).length;
R.resume = okN + '/' + R.checks.length + ' vérifications réussies';
console.log(R.resume, R.counts);
fs.writeFileSync(OUT + '/rapport.json', JSON.stringify(R, null, 1));
fs.writeFileSync(OUT + '/rapport.txt', [R.site + ' — ' + R.date, R.resume, '', ...R.checks.map(c => (c.ok ? 'OK     ' : 'ÉCHEC  ') + c.name + (c.detail !== undefined ? '\n         ' + JSON.stringify(c.detail).slice(0, 600) : '')), '', 'Requêtes réussies : ' + JSON.stringify(R.counts), '', 'Itinéraire, capacités : ' + JSON.stringify(R.routeCaps, null, 1), '', 'Itinéraire, variantes : ' + JSON.stringify(R.routeTries, null, 1), '', 'Communes « fontaineb » : ' + JSON.stringify(R.communeSearch), '', 'Erreurs HTTP :', ...R.http.slice(0, 60), '', 'Console :', ...R.console.slice(-80), '', 'Journal de l\'appli :', ...R.logs.map(String)].join('\n'));
await browser.close();
