// Photos libres de l'encyclopédie, étape 2 : télécharge les photos choisies (tools/photos/choix.json, numéros des planches
// de candidats.mjs), les réduit sans les recadrer (800 px et vignette 360 px au plus grand côté) et écrit les crédits dans data/encyclo/photos.json.
// Usage : node construire.mjs <candidats.json> <choix.json> <dossier data/encyclo>
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const [, , CAND, CHOIX, OUT] = process.argv;
const cand = JSON.parse(readFileSync(CAND, 'utf8')), choix = JSON.parse(readFileSync(CHOIX, 'utf8'));
const UA = 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi; photos libres pour une encyclopédie)';
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function api(params) {
  const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2' }, params));
  for (let k = 0; k < 5; k++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) return await r.json(); } catch (e) { /* réessai */ } await sleep(2000 * (k + 1)); }
  throw new Error('API Commons injoignable');
}
async function image(url) {
  for (let k = 0; k < 7; k++) {
    await sleep(500 + 2000 * k);
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) return Buffer.from(await r.arrayBuffer()); } catch (e) { /* réessai */ }
  }
  throw new Error('image indisponible : ' + url);
}
const dir = OUT + '/photos';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const sp = {}, h = createHash('sha1');
let total = 0;
for (const [id, nums] of Object.entries(choix)) {
  const list = [];
  for (const n of nums) {
    const c = (cand[id] || [])[n]; if (!c) { console.log(id, n, 'absent des candidats'); continue; }
    const j = await api({ action: 'query', titles: c.title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '960' });
    const ii = j.query.pages[0].imageinfo[0];
    const buf = await image(ii.thumburl || ii.url);
    const k = list.length, f = id + '-' + k + '.jpg', t = id + '-' + k + '-t.jpg';
    const big = await sharp(buf).rotate().resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70, mozjpeg: true }).toBuffer();
    const sm = await sharp(buf).rotate().resize(360, 360, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 66, mozjpeg: true }).toBuffer();
    writeFileSync(dir + '/' + f, big); writeFileSync(dir + '/' + t, sm);
    h.update(big); total += big.length + sm.length;
    list.push({ f, t, a: c.artist, l: c.license, u: c.url });
  }
  sp[id] = list;
  console.log(id.padEnd(16), list.length, 'photos');
}
writeFileSync(OUT + '/photos.json', JSON.stringify({ v: h.digest('hex').slice(0, 8), sp }));
console.log('total ' + (total / 1e6).toFixed(1) + ' Mo');
