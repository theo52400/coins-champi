// Photos libres de l'encyclopédie, étape 1 : pour chaque espèce, cherche des photos sur Wikimedia Commons
// (catégorie de l'espèce + image principale de Wikipédia), garde les licences libres (CC0, CC BY, CC BY-SA, domaine public)
// et fabrique une planche numérotée par espèce pour choisir à l'œil. Usage : node candidats.mjs <especes.json> <dossier>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const [, , LIST, OUT] = process.argv;
const SP = JSON.parse(readFileSync(LIST, 'utf8'));
const UA = 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi; photos libres pour une encyclopédie)';
const BAD = /spore|micro|cystid|basidi|hyphae|drawing|illustration|\bplates?\b|planche|herbari|stamp|briefmarke|timbre|\bmaps?\b|\brange\b|distribution|\.svg|sowerby|bulliard|krombholz|\blenz\b|\bicon\b|painting|museum|dried|getrocknet|séché|\bmarket|\bmarkt|marché|\bdish\b|\bfood\b|soup|recipe|cooking|cooked|pickled|in.?vitro|\bculture\b|mycel|\bkit\b|\bcoin\b|\blabel\b|\blogo\b|\btext\b|\bbook\b|\bpage\b|\bscan\b/i;
const FREE = /^(cc0|cc[ -]by(-sa)?[ -]?[\d.]*|cc[ -]by[ -]sa[ -]?[\d.]*|public domain|pd|attribution|cc-by-sa-[\d.]+|cc-by-[\d.]+)/i;
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function api(host, params) {
  const u = 'https://' + host + '/w/api.php?' + new URLSearchParams(Object.assign({ format: 'json', formatversion: '2' }, params));
  for (let k = 0; k < 4; k++) {
    try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) return await r.json(); } catch (e) { /* réessai */ }
    await new Promise(res => setTimeout(res, 1500 * (k + 1)));
  }
  return null;
}
function info(p) {
  const ii = p && p.imageinfo && p.imageinfo[0]; if (!ii) return null;
  const m = ii.extmetadata || {};
  const lic = strip(m.LicenseShortName && m.LicenseShortName.value);
  return {
    title: p.title, w: ii.width, h: ii.height, mime: ii.mime, thumb: ii.thumburl, url: ii.descriptionurl,
    artist: strip(m.Artist && m.Artist.value).slice(0, 120) || 'auteur inconnu', license: lic, licenseUrl: m.LicenseUrl ? strip(m.LicenseUrl.value) : '',
    quality: /quality|featured|valued/i.test((m.Assessments && m.Assessments.value) || '') || /Quality images|Featured pictures|Valued images/i.test((m.Categories && m.Categories.value) || '')
  };
}
// Images : Wikimedia limite le débit ; on attend et on réessaie si la réponse n'est pas une image
async function getImage(url) {
  for (let k = 0; k < 6; k++) {
    await new Promise(res => setTimeout(res, 400 + 1500 * k));
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok && /^image\//.test(r.headers.get('content-type') || '')) return Buffer.from(await r.arrayBuffer());
    } catch (e) { /* réessai */ }
  }
  throw new Error('image indisponible');
}
const IIP = { prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '480', iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|Assessments|Categories' };
mkdirSync(OUT, { recursive: true });
const all = {};
for (const [id, names] of Object.entries(SP)) {
  const seen = new Map(), lead = new Set();
  for (const name of names) {
    // image principale des articles Wikipédia (anglais, français)
    for (const host of ['en.wikipedia.org', 'fr.wikipedia.org']) {
      const j = await api(host, { action: 'query', titles: name, redirects: '1', prop: 'pageimages', piprop: 'name' });
      const pg = j && j.query && j.query.pages && j.query.pages[0];
      if (pg && pg.pageimage) lead.add('File:' + pg.pageimage.replace(/_/g, ' '));
    }
    // fichiers de la catégorie Commons (et d'une sous-catégorie éventuelle « in France »)
    for (const cat of ['Category:' + name, 'Category:' + name + ' in France']) {
      const j = await api('commons.wikimedia.org', Object.assign({ action: 'query', generator: 'categorymembers', gcmtitle: cat, gcmtype: 'file', gcmlimit: '120' }, IIP));
      for (const p of (j && j.query && j.query.pages) || []) { const x = info(p); if (x) seen.set(x.title, x); }
    }
  }
  if (lead.size) {
    const j = await api('commons.wikimedia.org', Object.assign({ action: 'query', titles: [...lead].join('|') }, IIP));
    for (const p of (j && j.query && j.query.pages) || []) { const x = info(p); if (x) { x.lead = true; seen.set(x.title, x); } }
  }
  const ok = [...seen.values()].filter(x => x.mime === 'image/jpeg' && x.w >= 700 && x.h >= 500 && !BAD.test(x.title) && FREE.test(x.license));
  ok.sort((a, b) => (b.lead - a.lead) || (b.quality - a.quality) || (b.w * b.h - a.w * a.h));
  const pick = ok.slice(0, 15);
  all[id] = pick;
  // planche : 5 × 3 vignettes numérotées
  const tiles = [];
  for (let i = 0; i < pick.length; i++) {
    try {
      const buf = await getImage(pick[i].thumb);
      const img = await sharp(buf).resize(300, 225, { fit: 'cover' }).jpeg().toBuffer();
      const lab = Buffer.from('<svg width="300" height="225"><rect x="0" y="0" width="44" height="30" fill="#000" opacity=".75"/><text x="8" y="22" font-size="20" font-family="sans-serif" fill="#fff">' + i + (pick[i].lead ? '*' : '') + (pick[i].quality ? 'Q' : '') + '</text></svg>');
      tiles.push({ input: await sharp(img).composite([{ input: lab, top: 0, left: 0 }]).toBuffer(), left: (i % 5) * 304, top: Math.floor(i / 5) * 229 });
    } catch (e) { console.log(id, i, 'vignette', e.message); }
  }
  const rows = Math.max(1, Math.ceil(pick.length / 5));
  await sharp({ create: { width: 5 * 304, height: rows * 229, channels: 3, background: '#ffffff' } }).composite(tiles).jpeg({ quality: 70 }).toFile(OUT + '/' + id + '.jpg');
  console.log(id.padEnd(16), String(seen.size).padStart(4), 'fichiers,', String(ok.length).padStart(3), 'libres et nets, planche de', pick.length);
}
writeFileSync(OUT + '/candidats.json', JSON.stringify(all, null, 1));
