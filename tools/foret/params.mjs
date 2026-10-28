// Passerelle avec le modèle de l'appli (js/core.js) pour tools/foret/build.py :
//   node tools/foret/params.mjs params          → espèces, peuplements, seuils (JSON)
//   node tools/foret/params.mjs groups < t.json → numéro de peuplement (1..21) de chaque [code_tfv, tfv, essence]
import { Core as C } from '../../js/core.js';

const mode = process.argv[2];
if (mode === 'params') {
  console.log(JSON.stringify({
    gkeys: C.GKEYS,
    fam: C.GKEYS.map(k => C.GROUPS[k].f),
    colors: C.GKEYS.map(k => C.GROUPS[k].c),
    levels: C.LEVELS,
    species: C.SPECIES.map(s => ({ id: s.id, aff: C.GKEYS.map(k => s.aff[k] || 0), soil: s.soil, edge: s.edge }))
  }));
} else if (mode === 'groups') {
  let buf = '';
  process.stdin.on('data', d => { buf += d; });
  process.stdin.on('end', () => {
    const rows = JSON.parse(buf || '[]');
    console.log(JSON.stringify(rows.map(([code, label, ess]) => C.GIDX[C.groupOf(code, label, ess)] || 0)));
  });
} else {
  console.error('usage : params | groups');
  process.exit(2);
}
