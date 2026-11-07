// Icônes des espèces (chapeaux 3D figés) en WebP, pour que les listes de 60 espèces s'affichent sans calcul 3D sur le téléphone.
// À relancer quand on ajoute ou retouche une espèce (CAPS de js/avatar3d.js) :
//   CHROME=/chemin/vers/chrome node tools/icones/especes.cjs      (puppeteer-core requis)
// Écrit icons/especes/<chapeau>.webp et la liste des icônes dans sw.js (mise en cache hors ligne).
const fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..', '..'), OUT = path.join(ROOT, 'icons', 'especes'), ORIGIN = 'https://icones.test/';
const SIZE = 192;
(async () => {
  const exe = process.env.CHROME || (await require('@sparticuz/chromium').executablePath());
  const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (!u.startsWith(ORIGIN)) return req.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(u).pathname));
    if (u === ORIGIN) return req.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><body></body>' });
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) return req.respond({ status: 404, body: '' });
    req.respond({ status: 200, contentType: f.endsWith('.js') ? 'application/javascript' : 'application/octet-stream', body: fs.readFileSync(f) });
  });
  page.on('pageerror', e => console.error('page :', e.message));
  await page.goto(ORIGIN);
  const icons = await page.evaluate(async size => {
    const Av = await import('/js/avatar3d.js'), G = await import('/js/game.js');
    const caps = [...new Set(G.CATALOG.map(s => s.cap))];
    const out = {};
    for (const k of caps) {
      const img = new Image(); img.src = Av.speciesIcon(k, size); await img.decode();
      const c = document.createElement('canvas'); c.width = c.height = size; c.getContext('2d').drawImage(img, 0, 0);
      out[k] = c.toDataURL('image/webp', 0.86);
    }
    return out;
  }, SIZE);
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  let total = 0;
  for (const [k, url] of Object.entries(icons)) {
    if (!url.startsWith('data:image/webp')) throw new Error('WebP non pris en charge pour ' + k);
    const buf = Buffer.from(url.split(',')[1], 'base64'); total += buf.length;
    fs.writeFileSync(path.join(OUT, k + '.webp'), buf);
  }
  // liste pour le service worker (entre les deux marqueurs)
  const swPath = path.join(ROOT, 'sw.js'), sw = fs.readFileSync(swPath, 'utf8');
  const list = Object.keys(icons).sort().map(k => "'icons/especes/" + k + ".webp'");
  const lines = []; for (let i = 0; i < list.length; i += 4) lines.push('  ' + list.slice(i, i + 4).join(', ') + ',');
  const re = /(  \/\/ icônes des espèces : début\n)[\s\S]*?(  \/\/ icônes des espèces : fin)/;
  if (!re.test(sw)) throw new Error('marqueurs des icônes absents de sw.js');
  fs.writeFileSync(swPath, sw.replace(re, (m, a, b) => a + lines.join('\n') + '\n' + b));
  console.log(Object.keys(icons).length + ' icônes, ' + (total / 1024).toFixed(0) + ' Ko');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
