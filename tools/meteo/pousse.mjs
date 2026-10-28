// Météo de pousse pour toute la France : un point tous les 0,5°, résumé des 3 dernières semaines et de la semaine à venir.
// Lancé chaque matin par .github/workflows/meteo-france.yml ; écrit data/meteo/pousse.json, lu par la carte « Ça pousse ».
// Usage : node tools/meteo/pousse.mjs [sortie.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Core as C } from '../../js/core.js';

const OUT = process.argv[2] || 'data/meteo/pousse.json';
const STEP = 0.5;
// Masque : cases de 1° couvertes par la carte des forêts (ou à défaut par la géologie de la France)
function maskTiles() {
  for (const f of ['data/foret/index.json', 'data/geol/index.json']) {
    try { const j = JSON.parse(readFileSync(f, 'utf8')); if (Array.isArray(j.tiles) && j.tiles.length) return { src: f, set: new Set(j.tiles.map(t => t[0] + '_' + t[1])) }; } catch (e) { /* suivant */ }
  }
  throw new Error('aucun index de cases (data/foret ou data/geol)');
}
const mask = maskTiles();
const pts = [];
for (let la = 41.25; la < 51.6; la += STEP) for (let lo = -5.25; lo < 10; lo += STEP) {
  if (mask.set.has(Math.floor(la) + '_' + Math.floor(lo))) pts.push([+la.toFixed(2), +lo.toFixed(2)]);
}
console.log(pts.length + ' points (masque ' + mask.src + ')');

const todayISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
const DAILY = 'precipitation_sum,temperature_2m_mean,temperature_2m_min,temperature_2m_max';
async function batch(list, tries = 4) {
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + list.map(p => p[0]).join(',') + '&longitude=' + list.map(p => p[1]).join(',') +
    '&daily=' + DAILY + '&past_days=21&forecast_days=7&timezone=Europe%2FParis';
  for (let k = 1; ; k++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi)' }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
      const j = await r.json();
      return Array.isArray(j) ? j : [j];
    } catch (e) {
      if (k >= tries) throw e;
      console.log('nouvel essai (' + e.message + ')');
      await new Promise(res => setTimeout(res, 5000 * k));
    }
  }
}
const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
const out = [];
let okN = 0;
for (let i = 0; i < pts.length; i += 50) {
  const part = pts.slice(i, i + 50), res = await batch(part);
  res.forEach((j, k) => {
    const w = C.summarizeWeather(j, todayISO);
    if (w && w.ok) okN++;
    out.push(w ? [part[k][0], part[k][1], r1(w.r14), r1(w.r3), r1(w.t7), w.frost5, r1(w.f7), r1(w.ft7), w.ok ? 1 : 0] : [part[k][0], part[k][1], null, null, null, 0, null, null, 0]);
  });
}
if (okN < pts.length * 0.8) throw new Error('trop de points sans météo : ' + okN + '/' + pts.length);
const doc = { v: todayISO, gen: new Date().toISOString(), step: STEP, cols: ['lat', 'lon', 'r14', 'r3', 't7', 'frost5', 'f7', 'ft7', 'ok'], pts: out };
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(doc));
console.log('écrit ' + OUT + ' : ' + out.length + ' points, ' + okN + ' complets, ' + (JSON.stringify(doc).length / 1024).toFixed(1) + ' Ko');
