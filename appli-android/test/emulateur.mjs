// Test de l'appli Android dans l'émulateur : vraie appli, vrais services (Firebase, IGN), GPS simulé.
// Vérifie surtout que la position et la trace continuent écran éteint, et que les alertes du groupe arrivent
// en notification. Tout ce que le test crée dans Firebase est effacé à la fin.
import pw from 'playwright';
import fs from 'fs';
import { execSync } from 'child_process';

const { _android: android } = pw;
const OUT = process.argv[2] || '/tmp/android-test';
const PKG = 'io.github.theo52400.coinsachampi';
const REPO = process.env.GITHUB_WORKSPACE || '.';
const cfgSrc = fs.readFileSync(REPO + '/config.js', 'utf8');
const API_KEY = (cfgSrc.match(/apiKey:\s*'([^']+)'/) || [])[1], PROJECT = (cfgSrc.match(/projectId:\s*'([^']+)'/) || [])[1];
const R = { date: new Date().toISOString(), checks: [], notes: [] };
const check = (name, ok, detail) => { R.checks.push({ name, ok: !!ok, detail }); console.log((ok ? 'OK     ' : 'ÉCHEC  ') + name + (detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 500) : '')); };
const note = t => { R.notes.push(new Date().toISOString().slice(11, 19) + ' ' + t); console.log('  · ' + t); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const adb = cmd => { try { return execSync('adb ' + cmd, { encoding: 'utf8', timeout: 60000 }); } catch (e) { return 'ERREUR ' + e.message; } };
const geo = (lat, lng) => adb('emu geo fix ' + lng.toFixed(6) + ' ' + lat.toFixed(6));
const notifs = () => adb('shell dumpsys notification --noredact');

let device, page;
async function connect() {
  [device] = await android.devices();
  if (!device) throw new Error('pas d\'émulateur');
  const wv = await device.webView({ pkg: PKG }, { timeout: 90000 });
  page = await wv.page();
  page.setDefaultTimeout(30000);
  return page;
}
async function disconnect() { try { await device.close(); } catch (e) { /* déjà fermé */ } device = page = null; }
const shot = async n => { try { fs.writeFileSync(OUT + '/' + n + '.png', execSync('adb exec-out screencap -p', { maxBuffer: 64 << 20 })); } catch (e) { note('capture ' + n + ' : ' + e.message); } };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, 'exception : ' + String(e.message).split('\n')[0]); } };

// ---------- Firestore en REST (pour le joueur « robot » qui envoie une alerte) ----------
const enc = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'boolean' ? { booleanValue: v } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'string' ? { stringValue: v } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const ROOT = 'projects/' + PROJECT + '/databases/(default)/documents';
async function rest(method, url, token, body) {
  const r = await fetch(url, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { /* texte */ }
  if (!r.ok) throw new Error(method + ' ' + url.split('?')[0].slice(-60) + ' : HTTP ' + r.status + ' ' + t.slice(0, 200));
  return j;
}
const commit = (token, writes) => rest('POST', 'https://firestore.googleapis.com/v1/' + ROOT + ':commit', token, { writes });

const robot = {};
let gid = null, uid = null;
const T0 = Date.now();

await step('Démarrage', async () => {
  adb('shell am start -n ' + PKG + '/.MainActivity');
  await connect();
  const ok = await page.waitForFunction(() => window.CC && CC.S && CC.S.sync, null, { timeout: 90000 }).then(() => true, () => false);
  const st = await page.evaluate(() => ({ pont: !!window.androidBridge, natif: !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()), kind: CC.S.sync && CC.S.sync.kind, url: location.href, sw: navigator.serviceWorker && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null }));
  check('L\'appli démarre et se connecte au jeu (Firebase)', ok && st.pont && st.natif && st.kind === 'firebase', st);
  uid = await page.evaluate(() => CC.S.uid);
  // la carte vient sur ma position dès la première mesure
  const cen = await page.waitForFunction(() => CC.S.gps.fix && CC.M.map.getZoom() >= 15 && Math.abs(CC.M.map.getCenter().lat - CC.S.gps.fix.lat) < 0.001, null, { timeout: 30000 }).then(() => true, () => false);
  const v = await page.evaluate(() => ({ z: CC.M.map.getZoom(), c: CC.M.map.getCenter(), fix: CC.S.gps.fix && [CC.S.gps.fix.lat, CC.S.gps.fix.lng] }));
  check('À l\'ouverture, la carte vient sur ma position', cen, v);
  const rock = await page.waitForFunction(() => CC.M.rockAt(49.06, 7.50), null, { timeout: 20000 }).then(h => h.jsonValue(), () => null)
    .catch(() => null) || await page.evaluate(async () => { CC.M.map.setView([49.06, 7.50], 11); for (let i = 0; i < 60 && !CC.M.rockAt(49.06, 7.50); i++) await new Promise(r => setTimeout(r, 250)); return CC.M.rockAt(49.06, 7.50); });
  check('Sous-sol lu dans l\'appli (Vosges du Nord : grès)', rock && rock.c === 1 && /Grès/.test(rock.n), rock);
  await sleep(4000); await shot('1-ouverture');
});

await step('Profil et groupe', async () => {
  await page.evaluate(async () => {
    const Av = await import('./js/avatar3d.js');
    await CC.S.sync.saveMe({ name: 'Vérif appli', avatar: Av.normalizeAvatar({ cap: 'girolle', acc: 'panier' }) });
  });
  gid = await page.evaluate(async () => { const g = await CC.S.sync.createGroup('Vérif appli', { name: 'Vérif appli', xp: 0 }); localStorage.setItem('cc.gid', JSON.stringify(g)); return g; });
  await page.reload();
  const ok = await page.waitForFunction(() => window.CC && CC.S.sync && CC.S.me && CC.S.gid, null, { timeout: 60000 }).then(() => true, () => false);
  check('Profil créé, groupe de test créé', ok && !!gid, { gid });
  await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.hidden = true; const b = document.getElementById('banner'); if (b) b.hidden = true; });
  await page.waitForFunction(() => document.querySelector('.pm.me'), null, { timeout: 30000 }).catch(() => {});
  await sleep(2500); await shot('2-carte');
});

await step('Sortie', async () => {
  await page.evaluate(() => document.getElementById('btn-sortie').click());
  await page.waitForSelector('[data-act="ss-go"]');
  await page.evaluate(() => { document.getElementById('ss-share').checked = true; document.querySelector('[data-act="ss-go"]').click(); });
  const ok = await page.waitForFunction(() => CC.S.gps.native && CC.S.sortie, null, { timeout: 30000 }).then(() => true, () => false);
  await sleep(3000);
  check('Sortie lancée : suivi natif (la notification apparaît quand l\'appli passe en arrière-plan)', ok, { native: ok });
  // marche au premier plan
  for (let i = 1; i <= 4; i++) { geo(49.0400 + i * 0.0002, 7.5200 + i * 0.0002); await sleep(2500); }
  const st = await page.evaluate(() => ({ trace: CC.S.sortie.track.length, fix: CC.S.gps.fix && [CC.S.gps.fix.lat, CC.S.gps.fix.lng] }));
  check('Au premier plan : la trace avance', st.trace >= 2 && st.fix && Math.abs(st.fix[0] - 49.0408) < 0.0002, st);
  await shot('3-sortie');
});

// ---------- écran éteint, téléphone « dans la poche » ----------
let bgStart = 0, bgEnd = 0, lastBg = null, robotTs = 0;
await step('Écran éteint', async () => {
  await disconnect();          // le débogueur ne doit pas garder la page éveillée
  adb('shell input keyevent KEYCODE_HOME');
  await sleep(1500);
  adb('shell input keyevent KEYCODE_SLEEP');
  bgStart = Date.now();
  note('écran éteint, application en arrière-plan');
  // marche de 6 minutes, une position toutes les 20 s (au-delà des 5 minutes où Android ralentit la page)
  for (let i = 1; i <= 18; i++) {
    const lat = 49.0408 + i * 0.00025, lng = 7.5208 + i * 0.00012;
    geo(lat, lng); lastBg = [lat, lng];
    if (i === 16 && API_KEY) {
      // un autre joueur envoie « Venez voir ! » pendant que le téléphone est dans la poche
      try {
        const su = await rest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + API_KEY, null, { returnSecureToken: true });
        robot.token = su.idToken; robot.uid = su.localId;
        await commit(robot.token, [{ update: { name: ROOT + '/groups/' + gid + '/members/' + robot.uid, fields: enc({ name: 'Robot de test', joinedAt: Date.now() }).mapValue.fields } }]);
        robotTs = Date.now();
        robot.eid = 'verif' + robotTs;
        await commit(robot.token, [{ update: { name: ROOT + '/groups/' + gid + '/events/' + robot.eid, fields: enc({ type: 'look', name: 'Robot de test', msg: 'Test de l\'appli', lat: lat + 0.002, lng, uid: robot.uid, ts: robotTs }).mapValue.fields } }]);
        note('alerte du robot envoyée');
      } catch (e) { note('robot : ' + e.message); }
    }
    await sleep(20000);
  }
  await sleep(30000);
  const n = notifs();
  fs.writeFileSync(OUT + '/notifications.txt', n);
  check('Écran éteint : la notification de suivi est toujours là', /sortie en cours/.test(n));
  check('Écran éteint : l\'alerte d\'un autre joueur arrive en notification', /Robot de test/.test(n), robotTs ? 'alerte envoyée' : 'pas d\'alerte envoyée');
  // ce que les autres joueurs voient, lu sur le serveur avant de rallumer l'écran
  if (robot.token) {
    try {
      const d = await rest('GET', 'https://firestore.googleapis.com/v1/' + ROOT + '/groups/' + gid + '/presence/' + uid, robot.token);
      const f = d.fields || {}, num = x => x ? Number(x.doubleValue !== undefined ? x.doubleValue : x.integerValue) : null;
      robot.presence = { lat: num(f.lat), lng: num(f.lng), ts: num(f.ts) };
      const p = robot.presence, near = lastBg && Math.abs(p.lat - lastBg[0]) < 0.0012 && Math.abs(p.lng - lastBg[1]) < 0.0012;
      check('Écran éteint : les autres joueurs voient ma position avancer (lue sur le serveur)', p.ts >= bgStart + 5 * 60000 && near, { presence: p, dernierePosition: lastBg, minutesApresExtinction: Math.round((p.ts - bgStart) / 6000) / 10 });
    } catch (e) { check('Écran éteint : les autres joueurs voient ma position avancer (lue sur le serveur)', false, e.message); }
  }
  adb('shell input keyevent KEYCODE_WAKEUP'); await sleep(1500);
  adb('shell wm dismiss-keyguard'); await sleep(1000);
  adb('shell cmd statusbar expand-notifications'); await sleep(2000); await shot('4-notifications'); adb('shell cmd statusbar collapse');
  bgEnd = Date.now();
  adb('shell am start -n ' + PKG + '/.MainActivity');
  await sleep(4000);
});

await step('Retour dans l\'appli', async () => {
  await connect();
  await page.waitForFunction(() => window.CC && CC.S.sortie, null, { timeout: 30000 });
  const st = await page.evaluate(async ({ gid, bgStart, bgEnd }) => {
    const s = CC.S.sortie, tr = s.track;
    const inBg = tr.filter(p => s.start + p[2] * 1000 >= bgStart - 2000 && s.start + p[2] * 1000 <= bgEnd);
    const pres = await CC.S.sync.api.getDoc(CC.S.sync._d('groups', gid, 'presence', CC.S.uid)).then(d => d.exists() ? d.data() : null, e => 'erreur ' + e.code);
    return { trace: tr.length, pendant: inBg.length, dernier: tr[tr.length - 1], presence: pres && { lat: pres.lat, lng: pres.lng, ts: pres.ts }, logs: CC.logs.slice(-25) };
  }, { gid, bgStart, bgEnd });
  R.logsAppli = st.logs;
  const tsOk = st.trace && st.pendant >= 8;
  check('Écran éteint : la trace a continué (positions enregistrées pendant 6 min)', tsOk, { points: st.trace, pendantEcranEteint: st.pendant });
  const p = st.presence;
  const near = p && lastBg && Math.abs(p.lat - lastBg[0]) < 0.0012 && Math.abs(p.lng - lastBg[1]) < 0.0012;
  check('De retour dans l\'appli : position partagée à jour', p && near && p.ts >= bgStart, { presence: p, derniere: lastBg });
  await sleep(1500); await shot('5-retour');
});

await step('Fin de sortie', async () => {
  await page.evaluate(() => { const m = document.getElementById('modal'); if (m) m.hidden = true; document.getElementById('btn-sortie').click(); });
  await page.waitForSelector('[data-act="es-discard"]');
  await page.evaluate(() => { const b = document.querySelector('[data-act="es-discard"]'); b.click(); b.click(); });
  await sleep(3000);
  const n = notifs();
  const st = await page.evaluate(() => ({ native: CC.S.gps.native, sortie: !!CC.S.sortie }));
  check('Fin de sortie : suivi natif arrêté, notification retirée', !st.native && !st.sortie && !/sortie en cours/.test(n), st);
});

await step('Nettoyage', async () => {
  if (robot.token) {
    await rest('DELETE', 'https://firestore.googleapis.com/v1/' + ROOT + '/groups/' + gid + '/events/' + robot.eid, robot.token).catch(e => note(e.message));
    await rest('DELETE', 'https://firestore.googleapis.com/v1/' + ROOT + '/groups/' + gid + '/members/' + robot.uid, robot.token).catch(e => note(e.message));
    await rest('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + API_KEY, null, { idToken: robot.token }).catch(e => note(e.message));
  }
  const r = await page.evaluate(async gid => {
    const s = CC.S.sync, d = (...p) => s.api.deleteDoc(s._d(...p)).then(() => 'ok', e => e.code);
    const r = { presence: await d('groups', gid, 'presence', s.uid), membre: await d('groups', gid, 'members', s.uid), groupe: await d('groups', gid), profil: await d('users', s.uid) };
    // et le compte anonyme de test lui-même
    try { const t = await s.auth.currentUser.getIdToken(); const x = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key=' + s.config.apiKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: t }) }); r.compte = x.ok ? 'ok' : 'HTTP ' + x.status; } catch (e) { r.compte = e.message; }
    return r;
  }, gid);
  check('Données de test effacées de Firebase', Object.values(r).every(v => v === 'ok'), r);
});

R.resume = R.checks.filter(c => c.ok).length + '/' + R.checks.length + ' vérifications réussies, ' + Math.round((Date.now() - T0) / 60000) + ' min';
console.log(R.resume);
fs.writeFileSync(OUT + '/rapport.json', JSON.stringify(R, null, 1));
fs.writeFileSync(OUT + '/rapport.txt', [R.date, R.resume, '', ...R.checks.map(c => (c.ok ? 'OK     ' : 'ÉCHEC  ') + c.name + (c.detail !== undefined ? '\n         ' + JSON.stringify(c.detail).slice(0, 700) : '')), '', 'Déroulé :', ...R.notes, '', 'Journal de l\'appli :', ...(R.logsAppli || [])].join('\n'));
await disconnect();
process.exit(0);
