// À lancer avant chaque mise en ligne : donne au service worker un numéro de version tiré du contenu des fichiers,
// pour que les téléphones proposent « Mettre à jour » dès qu'un fichier a changé.
//   node tools/stamp-sw.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sw = readFileSync(join(root, 'sw.js'), 'utf8');
const list = sw.match(/const ASSETS = \[([\s\S]*?)\];/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1)).filter(a => a !== './');
const h = createHash('sha256');
for (const a of list) h.update(a + '\0').update(readFileSync(join(root, a)));
const version = 'v' + new Date().toISOString().slice(0, 10) + '-' + h.digest('hex').slice(0, 8);
writeFileSync(join(root, 'sw.js'), sw.replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`));
console.log('Service worker : version ' + version + ' (' + list.length + ' fichiers)');
