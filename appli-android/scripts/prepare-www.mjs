// Copie le site dans www/ pour l'appli Android : même code que le site, plus le pont Capacitor
// (vendor/capacitor-core.js) et le numéro de version de l'appli (app-version.json).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..'), APP = path.resolve(here, '..'), WWW = path.join(APP, 'www');
const ITEMS = ['index.html', 'manifest.webmanifest', 'config.js', 'sw.js', 'css', 'js', 'vendor', 'fonts', 'icons', 'data'];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const it of ITEMS) {
  const src = path.join(ROOT, it);
  if (!fs.existsSync(src)) throw new Error('fichier du site introuvable : ' + it);
  fs.cpSync(src, path.join(WWW, it), { recursive: true });
}
fs.copyFileSync(path.join(APP, 'node_modules', '@capacitor', 'core', 'dist', 'index.js'), path.join(WWW, 'vendor', 'capacitor-core.js'));
const build = parseInt(process.env.APP_BUILD || '0', 10) || 0;
const version = process.env.APP_VERSION || 'dev';
fs.writeFileSync(path.join(WWW, 'app-version.json'), JSON.stringify({ build, version, commit: (process.env.GITHUB_SHA || '').slice(0, 7) }) + '\n');
let n = 0; const count = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) count(path.join(d, e.name)); else n++; } };
count(WWW);
console.log('www/ prêt : ' + n + ' fichiers, appli n° ' + build + ' (' + version + ')');
