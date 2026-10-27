// Modèle de potentiel : peuplements BD Forêt × sol estimé × lisière, météo de pousse.
export const Core = (() => {
  const R = 6378137, HALF = Math.PI * R, D2R = Math.PI / 180;
  const mx = lon => lon * D2R * R;
  const my = lat => { const s = Math.sin(Math.max(-85, Math.min(85, lat)) * D2R); return 0.5 * R * Math.log((1 + s) / (1 - s)); };
  const lonOf = x => x / R / D2R;
  const latOf = y => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / D2R;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  function l93ToLonLat(x, y) {
    const n = 0.7256077650532670, C = 11754255.426096, Xs = 700000, Ys = 12655612.049876, e = 0.0818191910428158, lon0 = 3 * D2R;
    const dx = x - Xs, dy = y - Ys;
    const rr = Math.sqrt(dx * dx + dy * dy);
    const gamma = Math.atan(dx / -dy);
    const latIso = -1 / n * Math.log(Math.abs(rr / C));
    let phi = 2 * Math.atan(Math.exp(latIso)) - Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const es = e * Math.sin(phi);
      phi = 2 * Math.atan(Math.pow((1 + es) / (1 - es), e / 2) * Math.exp(latIso)) - Math.PI / 2;
    }
    return [(lon0 + gamma / n) / D2R, phi / D2R];
  }

  // Peuplements (codes TFV de la BD Forêt V2) regroupés en types utiles pour les champignons
  const GROUPS = {
    HET: { n: 'Hêtraie', f: 'f', c: '#4D9A2D' },
    CHE: { n: 'Chênaie', f: 'f', c: '#2D6A29' },
    FMX: { n: 'Feuillus mélangés', f: 'f', c: '#86B84F' },
    CHA: { n: 'Châtaigneraie', f: 'f', c: '#A3A23A' },
    ROB: { n: 'Robineraie', f: 'f', c: '#B7C468' },
    AFE: { n: 'Autre feuillu (frêne, aulne, érable…)', f: 'f', c: '#3B8F77' },
    PEU: { n: 'Peupleraie', f: 'f', c: '#D1AC31' },
    PSY: { n: 'Pin sylvestre', f: 'c', c: '#3E7CB1' },
    PIN: { n: 'Autres pins', f: 'c', c: '#6B9FCB' },
    SEP: { n: 'Sapin, épicéa', f: 'c', c: '#1D5587' },
    DOU: { n: 'Douglas', f: 'c', c: '#2E3F8C' },
    MEL: { n: 'Mélèze', f: 'c', c: '#8BB3D7' },
    CMX: { n: 'Conifères mélangés', f: 'c', c: '#4B6EA6' },
    MXF: { n: 'Mixte, surtout feuillus', f: 'm', c: '#5E8C67' },
    MXC: { n: 'Mixte, surtout résineux', f: 'm', c: '#4C7684' },
    OFE: { n: 'Forêt claire de feuillus', f: 'o', c: '#C2D689' },
    OCO: { n: 'Forêt claire de conifères', f: 'o', c: '#A7C4DE' },
    OMX: { n: 'Forêt claire mixte', f: 'o', c: '#BBCFB2' },
    NUE: { n: 'Coupe ou clairière', f: 'n', c: '#D5C3A1' },
    LAN: { n: 'Lande', f: 'n', c: '#C5A386' },
    HER: { n: 'Formation herbacée', f: 'n', c: '#E0D8AD' }
  };
  const GKEYS = Object.keys(GROUPS);
  const GIDX = Object.fromEntries(GKEYS.map((k, i) => [k, i + 1]));
  const TFV = { 'FF0': 'NUE', 'FF1-00': 'FMX', 'FF1-00-00': 'FMX', 'FF1-09-09': 'HET', 'FF1-10-10': 'CHA', 'FF1-14-14': 'ROB', 'FF1-49-49': 'AFE', 'FF1G01-01': 'CHE', 'FF1G06-06': 'CHE', 'FF2-00': 'CMX', 'FF2-00-00': 'CMX', 'FF2-51-51': 'PIN', 'FF2-52-52': 'PSY', 'FF2-57-57': 'PIN', 'FF2-63-63': 'MEL', 'FF2-64-64': 'DOU', 'FF2-80-80': 'PIN', 'FF2-81-81': 'PIN', 'FF2-90-90': 'CMX', 'FF2-91-91': 'CMX', 'FF2G53-53': 'PIN', 'FF2G58-58': 'PIN', 'FF2G61-61': 'SEP', 'FF31': 'MXF', 'FF32': 'MXC', 'FO0': 'NUE', 'FO1': 'OFE', 'FO2': 'OCO', 'FO3': 'OMX', 'FP': 'PEU', 'LA4': 'LAN', 'LA6': 'HER' };
  const norm = s => (s == null ? '' : String(s)).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe');
  function groupOf(code, label, ess) {
    const c = (code == null ? '' : String(code)).trim().toUpperCase();
    if (TFV[c]) return TFV[c];
    const t = norm(label) + ' ' + norm(ess);
    if (/peupl/.test(t)) return 'PEU';
    if (/lande/.test(t)) return 'LAN';
    if (/herbac/.test(t)) return 'HER';
    if (/sans couvert|coupe/.test(t)) return 'NUE';
    if (/ouverte/.test(t)) return (/melange|mixte/.test(t) || (/feuillu/.test(t) && /conif/.test(t))) ? 'OMX' : /conif|pin|sapin|epicea|douglas|meleze/.test(t) ? 'OCO' : 'OFE';
    if (/feuillus prepond/.test(t)) return 'MXF';
    if (/coniferes prepond/.test(t)) return 'MXC';
    if (/hetre/.test(t)) return 'HET';
    if (/chene/.test(t)) return 'CHE';
    if (/chataign/.test(t)) return 'CHA';
    if (/robinier/.test(t)) return 'ROB';
    if (/pin sylvestre/.test(t)) return 'PSY';
    if (/sapin|epicea/.test(t)) return 'SEP';
    if (/douglas/.test(t)) return 'DOU';
    if (/meleze/.test(t)) return 'MEL';
    if (/autre conifere/.test(t)) return 'CMX';
    if (/\bpins?\b/.test(t)) return 'PIN';
    if (/conif/.test(t)) return 'CMX';
    if (/autre feuillu/.test(t)) return 'AFE';
    return 'FMX';
  }

  // Sol estimé d'après la roche du sous-sol (carte géologique du BRGM) : 0 inconnu, 1 acide, 2 intermédiaire, 3 calcaire, 4 argileux
  const LITHO = [
    { n: 'Sol inconnu', d: 'pas encore estimé ici' },
    { n: 'Sol acide', d: 'grès, granite ou sables' },
    { n: 'Sol intermédiaire', d: 'légèrement acide à neutre' },
    { n: 'Sol calcaire', d: 'basique, sur calcaire ou craie' },
    { n: 'Sol argileux', d: 'lourd et frais, souvent marneux' }
  ];

  // soil: [inconnu, acide, intermédiaire, calcaire, argileux] · edge: [type, a, L(m)] · m: poids par mois · w: météo
  const SPECIES = [
    { id: 'cepe', n: 'Cèpes', lat: 'Boletus edulis, B. aereus, B. pinophilus',
      aff: { HET: 1, CHE: .9, FMX: .75, CHA: .9, ROB: .1, AFE: .3, PEU: .05, PSY: .8, PIN: .6, SEP: .85, DOU: .35, MEL: .2, CMX: .7, MXF: .9, MXC: .85, OFE: .7, OCO: .6, OMX: .65, NUE: .05, LAN: .1, HER: 0 },
      soil: [.75, 1, .85, .45, .8], edge: ['edge', .7, 90], eco: .22,
      m: { 6: .35, 7: .5, 8: .8, 9: 1, 10: 1, 11: .45 }, w: { tlo: 11, thi: 20, rain: 35, frost: .4 },
      hab: 'Lisières et clairières de hêtraies et de chênaies, sur sol acide et bien drainé ; aussi sous épicéas et pins sylvestres. Une à deux semaines après de bonnes pluies, par temps doux.',
      conf: 'Bolet amer (pores rosés, chair très amère) : il gâche le plat. Les bolets à pied rouge dont la chair bleuit sont à laisser.' },
    { id: 'girolle', n: 'Girolles', lat: 'Cantharellus cibarius',
      aff: { HET: 1, CHE: .95, FMX: .8, CHA: .85, ROB: .1, AFE: .3, PEU: 0, PSY: .7, PIN: .55, SEP: .8, DOU: .4, MEL: .3, CMX: .65, MXF: .9, MXC: .85, OFE: .6, OCO: .55, OMX: .6, NUE: .05, LAN: .15, HER: 0 },
      soil: [.75, 1, .85, .35, .78], edge: ['edge', .65, 70], eco: .2,
      m: { 6: .6, 7: .9, 8: 1, 9: .9, 10: .6, 11: .2 }, w: { tlo: 13, thi: 22, rain: 30, frost: .4 },
      hab: 'Talus moussus, bords de chemins et lisières de hêtraies-chênaies sur sol acide, souvent après les orages d\'été.',
      conf: 'Fausse girolle : vraies lames fines et serrées, orange vif. Clitocybe de l\'olivier, toxique, en touffes sur souches.' },
    { id: 'trompette', n: 'Trompettes', lat: 'Craterellus cornucopioides',
      aff: { HET: 1, CHE: .75, FMX: .85, CHA: .5, ROB: .1, AFE: .5, PEU: .05, PSY: .1, PIN: .1, SEP: .3, DOU: .1, MEL: .1, CMX: .2, MXF: .75, MXC: .45, OFE: .4, OCO: .15, OMX: .25, NUE: 0, LAN: 0, HER: 0 },
      soil: [.75, .55, .8, 1, .9], edge: ['int', .45, 50], eco: .05,
      m: { 8: .45, 9: .85, 10: 1, 11: .85, 12: .35 }, w: { tlo: 8, thi: 18, rain: 40, frost: .6 },
      hab: 'Sous-bois sombres et humides de hêtres et de charmes, sur sols argilo-calcaires riches. En colonies cachées dans les feuilles mortes.',
      conf: 'Peu de sosies dangereux. La chanterelle cendrée, très proche, est aussi comestible.' },
    { id: 'hydne', n: 'Pieds de mouton', lat: 'Hydnum repandum',
      aff: { HET: .85, CHE: .8, FMX: .8, CHA: .55, ROB: .1, AFE: .35, PEU: .05, PSY: .55, PIN: .5, SEP: .8, DOU: .4, MEL: .3, CMX: .65, MXF: .95, MXC: .95, OFE: .35, OCO: .35, OMX: .4, NUE: 0, LAN: .05, HER: 0 },
      soil: [.8, .8, .9, .9, .9], edge: ['int', .25, 50], eco: .12,
      m: { 1: .15, 8: .35, 9: .75, 10: 1, 11: .9, 12: .45 }, w: { tlo: 5, thi: 16, rain: 30, frost: .8 },
      hab: 'Sous-bois moussus de feuillus comme de résineux, sur presque tous les sols. Souvent en ronds ou en longues lignes.',
      conf: 'Des aiguillons sous le chapeau, pas de lames : aucun sosie dangereux, mais vérifiez bien ce critère.' },
    { id: 'tube', n: 'Chanterelles en tube', lat: 'Craterellus tubaeformis',
      aff: { HET: .55, CHE: .3, FMX: .35, CHA: .35, ROB: 0, AFE: .15, PEU: 0, PSY: .6, PIN: .5, SEP: 1, DOU: .6, MEL: .4, CMX: .85, MXF: .6, MXC: .9, OFE: .15, OCO: .4, OMX: .35, NUE: 0, LAN: .05, HER: 0 },
      soil: [.6, 1, .75, .25, .5], edge: ['int', .4, 50], eco: .05,
      m: { 1: .4, 2: .1, 9: .4, 10: .85, 11: 1, 12: .8 }, w: { tlo: 3, thi: 14, rain: 30, frost: .85 },
      hab: 'Mousses humides sous sapins et épicéas, sur sol acide. En troupes nombreuses, jusqu\'aux premières neiges.',
      conf: 'Danger : petits cortinaires roux à vraies lames, mortels. La chanterelle en tube a des plis et un pied creux.' },
    { id: 'bai', n: 'Bolets bais', lat: 'Imleria badia',
      aff: { HET: .65, CHE: .55, FMX: .5, CHA: .65, ROB: 0, AFE: .2, PEU: 0, PSY: .95, PIN: .8, SEP: 1, DOU: .6, MEL: .5, CMX: .9, MXF: .7, MXC: .9, OFE: .3, OCO: .6, OMX: .5, NUE: 0, LAN: .1, HER: 0 },
      soil: [.6, 1, .7, .15, .45], edge: ['int', .15, 50], eco: .08,
      m: { 8: .5, 9: .9, 10: 1, 11: .7, 12: .2 }, w: { tlo: 8, thi: 18, rain: 30, frost: .6 },
      hab: 'Pessières et pinèdes sur sol acide et sableux ; aussi sous hêtres et châtaigniers.',
      conf: 'Pores jaunes qui bleuissent au toucher : c\'est normal pour lui. Laissez tout bolet à pores rouges.' },
    { id: 'piedbleu', n: 'Pieds bleus', lat: 'Lepista nuda',
      aff: { HET: .8, CHE: .75, FMX: .85, CHA: .6, ROB: .5, AFE: .6, PEU: .5, PSY: .6, PIN: .6, SEP: .7, DOU: .6, MEL: .5, CMX: .7, MXF: .85, MXC: .8, OFE: .7, OCO: .65, OMX: .7, NUE: .3, LAN: .3, HER: .2 },
      soil: [.85, .75, .85, .9, .9], edge: ['neu', 0, 50], eco: .1,
      m: { 1: .35, 9: .25, 10: .75, 11: 1, 12: .75 }, w: { tlo: 3, thi: 13, rain: 25, frost: .9 },
      hab: 'Litière épaisse de feuilles ou d\'aiguilles, souvent en ronds. Tard en saison, même après les premières gelées.',
      conf: 'Cortinaires violets : sporée brun rouille et voile en toile sous le chapeau jeune. La sporée du pied bleu est rose pâle.' },
    { id: 'coulemelle', n: 'Coulemelles', lat: 'Macrolepiota procera',
      aff: { HET: .55, CHE: .7, FMX: .65, CHA: .65, ROB: .55, AFE: .5, PEU: .45, PSY: .65, PIN: .6, SEP: .35, DOU: .35, MEL: .45, CMX: .45, MXF: .6, MXC: .5, OFE: 1, OCO: .85, OMX: .95, NUE: .8, LAN: .7, HER: .7 },
      soil: [.9, .9, .9, .9, .9], edge: ['edge', .45, 60], eco: 0,
      m: { 7: .55, 8: .9, 9: 1, 10: .75, 11: .2 }, w: { tlo: 12, thi: 22, rain: 25, frost: .4 },
      hab: 'Lisières, clairières, bords de chemins forestiers et prés en bordure de bois.',
      conf: 'Petites lépiotes mortelles : ne prenez que des chapeaux de plus de 10 cm, avec un anneau double coulissant et un pied tigré.' },
    { id: 'morille', n: 'Morilles', lat: 'Morchella spp.',
      aff: { HET: .3, CHE: .35, FMX: .6, CHA: .2, ROB: .35, AFE: .85, PEU: .85, PSY: .2, PIN: .2, SEP: .2, DOU: .2, MEL: .2, CMX: .2, MXF: .4, MXC: .25, OFE: .6, OCO: .25, OMX: .4, NUE: .5, LAN: .2, HER: .3 },
      soil: [.75, .25, .6, 1, .85], edge: ['edge', .55, 50], eco: .05,
      m: { 3: .6, 4: 1, 5: .65, 6: .15 }, w: { tlo: 8, thi: 16, rain: 15, frost: .5 },
      hab: 'Frênaies et peupleraies des fonds de vallée, sols calcaires ou alluviaux, terrains remués. Au printemps, quand le sol se réchauffe.',
      conf: 'Gyromitre, toxique : chapeau en forme de cerveau, sans alvéoles. Les morilles se mangent toujours bien cuites.' },
    { id: 'lactaire', n: 'Lactaires délicieux', lat: 'Lactarius deliciosus, L. deterrimus',
      aff: { HET: 0, CHE: 0, FMX: 0, CHA: 0, ROB: 0, AFE: 0, PEU: 0, PSY: .9, PIN: 1, SEP: .7, DOU: .3, MEL: .2, CMX: .8, MXF: .4, MXC: .7, OFE: 0, OCO: .9, OMX: .6, NUE: .05, LAN: .1, HER: .05 },
      soil: [.75, .6, .8, 1, .8], edge: ['edge', .6, 50], eco: .05,
      m: { 8: .5, 9: .9, 10: 1, 11: .6 }, w: { tlo: 9, thi: 18, rain: 30, frost: .6 },
      hab: 'Jeunes pinèdes et plantations de pins, souvent sur calcaire ; le lactaire de l\'épicéa pousse sous les épicéas.',
      conf: 'Lait orange carotte. Le lactaire à toison (lait blanc, chapeau laineux) est toxique.' }
  ];
  const LEVELS = [0.45, 0.65, 0.85];

  function edgeF(e, d) {
    if (e[0] === 'edge') return e[1] + (1 - e[1]) * Math.exp(-d / e[2]);
    if (e[0] === 'int') return 1 - e[1] * Math.exp(-d / e[2]);
    return 1;
  }

  function cellGround(z) { return z <= 13 ? 60 : z === 14 ? 35 : z === 15 ? 22 : z === 16 ? 14 : 10; }

  function makeGrid(minx, miny, maxx, maxy, cs, margin) {
    const x0 = Math.floor(minx / cs - margin) * cs;
    const y0 = Math.floor(miny / cs - margin) * cs;
    const nx = Math.max(1, Math.ceil((maxx - x0) / cs + margin));
    const ny = Math.max(1, Math.ceil((maxy - y0) / cs + margin));
    return { x0, y0, cs, nx, ny };
  }

  // Remplissage par balayage (pair-impair) d'un polygone en coordonnées mercator
  function rasterize(rings, bb, grid, value, out) {
    const { x0, y0, cs, nx, ny } = grid;
    if (bb[2] < x0 || bb[0] > x0 + nx * cs || bb[3] < y0 || bb[1] > y0 + ny * cs) return;
    const j0 = Math.max(0, Math.ceil((bb[1] - y0) / cs - 0.5));
    const j1 = Math.min(ny - 1, Math.floor((bb[3] - y0) / cs - 0.5));
    if (j1 < j0) return;
    const rows = j1 - j0 + 1;
    const buckets = new Array(rows);
    for (const r of rings) {
      const n = r.length;
      for (let k = 0, m = n - 2; k < n; m = k, k += 2) {
        const ya = r[m + 1], yb = r[k + 1];
        if (ya === yb) continue;
        const lo = ya < yb ? ya : yb, hi = ya < yb ? yb : ya;
        let a = Math.ceil((lo - y0) / cs - 0.5), b = Math.ceil((hi - y0) / cs - 0.5) - 1;
        if (a < j0) a = j0;
        if (b > j1) b = j1;
        if (b < a) continue;
        const xa = r[m], xb = r[k];
        const slope = (xb - xa) / (yb - ya);
        for (let j = a; j <= b; j++) {
          const y = y0 + (j + 0.5) * cs;
          const x = xa + (y - ya) * slope;
          const idx = j - j0;
          (buckets[idx] || (buckets[idx] = [])).push(x);
        }
      }
    }
    for (let q = 0; q < rows; q++) {
      const xs = buckets[q];
      if (!xs || xs.length < 2) continue;
      xs.sort((u, v) => u - v);
      const row = (q + j0) * nx;
      for (let p = 0; p + 1 < xs.length; p += 2) {
        let i0 = Math.ceil((xs[p] - x0) / cs - 0.5), i1 = Math.ceil((xs[p + 1] - x0) / cs - 0.5) - 1;
        if (i0 < 0) i0 = 0;
        if (i1 > nx - 1) i1 = nx - 1;
        for (let i = i0; i <= i1; i++) out[row + i] = value;
      }
    }
  }

  function pointInRings(rings, x, y) {
    let inside = false;
    for (const r of rings) {
      const n = r.length;
      for (let k = 0, m = n - 2; k < n; m = k, k += 2) {
        const xa = r[m], ya = r[m + 1], xb = r[k], yb = r[k + 1];
        if ((ya > y) !== (yb > y) && x < xa + (y - ya) * (xb - xa) / (yb - ya)) inside = !inside;
      }
    }
    return inside;
  }

  function chamfer(src, nx, ny) {
    const N = nx * ny, d = new Float32Array(N), INF = 1e9, S = Math.SQRT2;
    for (let k = 0; k < N; k++) d[k] = src[k] ? 0 : INF;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i; let v = d[k]; if (v === 0) continue;
      if (i > 0 && d[k - 1] + 1 < v) v = d[k - 1] + 1;
      if (j > 0) {
        if (d[k - nx] + 1 < v) v = d[k - nx] + 1;
        if (i > 0 && d[k - nx - 1] + S < v) v = d[k - nx - 1] + S;
        if (i < nx - 1 && d[k - nx + 1] + S < v) v = d[k - nx + 1] + S;
      }
      d[k] = v;
    }
    for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i; let v = d[k]; if (v === 0) continue;
      if (i < nx - 1 && d[k + 1] + 1 < v) v = d[k + 1] + 1;
      if (j < ny - 1) {
        if (d[k + nx] + 1 < v) v = d[k + nx] + 1;
        if (i < nx - 1 && d[k + nx + 1] + S < v) v = d[k + nx + 1] + S;
        if (i > 0 && d[k + nx - 1] + S < v) v = d[k + nx - 1] + S;
      }
      d[k] = v;
    }
    return d;
  }

  // known: {z, has(tx, ty)} — zones dont les forêts sont chargées
  function computeLayers(grid, feats, litho, known) {
    const { x0, y0, cs, nx, ny } = grid, N = nx * ny;
    const fi = new Int32Array(N).fill(-1);
    for (let f = 0; f < feats.length; f++) rasterize(feats[f].rings, feats[f].bb, grid, f, fi);
    const li = new Uint8Array(N);
    // litho : fonction (x, y) -> classe de sol au centre de chaque case, ou liste de polygones classés
    if (typeof litho === 'function') {
      for (let j = 0; j < ny; j++) { const yc = y0 + (j + 0.5) * cs; for (let i = 0; i < nx; i++) li[j * nx + i] = litho(x0 + (i + 0.5) * cs, yc); }
    } else for (const L of litho) rasterize(L.rings, L.bb, grid, L.v, li);
    const kn = new Uint8Array(N);
    const n2 = Math.pow(2, known.z), W = 2 * HALF;
    const tx = new Int32Array(nx), ty = new Int32Array(ny);
    for (let i = 0; i < nx; i++) tx[i] = Math.floor((x0 + (i + 0.5) * cs + HALF) / W * n2);
    for (let j = 0; j < ny; j++) ty[j] = Math.floor((HALF - (y0 + (j + 0.5) * cs)) / W * n2);
    const gi = new Uint8Array(N), open = new Uint8Array(N);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!known.has(tx[i], ty[j])) continue;
      kn[k] = 1;
      const f = fi[k];
      if (f >= 0) {
        const g = feats[f].g;
        gi[k] = GIDX[g] || 0;
        if (GROUPS[g].f === 'n') open[k] = 1;
      } else open[k] = 1;
    }
    const dist = chamfer(open, nx, ny);
    const eco = new Uint8Array(N);
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i, g = gi[k];
      if (!g || open[k]) continue;
      const fam = GROUPS[GKEYS[g - 1]].f;
      let e = 0;
      for (let dj = -1; dj <= 1 && e < 2; dj++) for (let di = -1; di <= 1; di++) {
        const q = k + dj * nx + di, h = gi[q];
        if (!h || h === g || open[q]) continue;
        e = GROUPS[GKEYS[h - 1]].f !== fam ? 2 : Math.max(e, 1);
        if (e === 2) break;
      }
      eco[k] = e;
    }
    return { fi, li, kn, gi, open, dist, eco };
  }

  function potentials(layers, grid, cg) {
    const N = grid.nx * grid.ny, out = [];
    for (const sp of SPECIES) {
      const p = new Float32Array(N);
      const affByIdx = new Float32Array(GKEYS.length + 1);
      GKEYS.forEach((g, i) => { affByIdx[i + 1] = sp.aff[g] || 0; });
      for (let k = 0; k < N; k++) {
        const g = layers.gi[k];
        if (!layers.kn[k] || !g) continue;
        const a = affByIdx[g];
        if (a <= 0) continue;
        const e = layers.eco[k];
        const v = a * sp.soil[layers.li[k]] * edgeF(sp.edge, layers.dist[k] * cg) * (1 + sp.eco * (e === 2 ? 1 : e === 1 ? 0.5 : 0));
        p[k] = v > 1 ? 1 : v;
      }
      out.push(p);
    }
    return out;
  }

  function seasonOf(sp, month) { return sp.m[month] || 0; }

  // « De saison » : moyenne des deux meilleures espèces de saison (un coin fort = au moins deux espèces favorables)
  function bestOf(pots, month, N) {
    const best = new Float32Array(N), who = new Uint8Array(N);
    const w = SPECIES.map(sp => seasonOf(sp, month));
    const any = w.some(v => v > 0);
    const f = w.map(ws => any ? (ws > 0 ? (0.55 + 0.45 * ws) * (ws >= 0.25 ? 1 : ws / 0.25) : 0) : 1);
    const S = SPECIES.length;
    for (let k = 0; k < N; k++) {
      let a = 0, b = 0, ia = -1;
      for (let s = 0; s < S; s++) {
        if (!f[s]) continue;
        const v = pots[s][k] * f[s];
        if (v > a) { b = a; a = v; ia = s; } else if (v > b) b = v;
      }
      if (ia >= 0) { best[k] = (a + b) / 2; who[k] = ia + 1; }
    }
    return { best, who };
  }

  function levelOf(v) { return v >= LEVELS[2] ? 3 : v >= LEVELS[1] ? 2 : v >= LEVELS[0] ? 1 : 0; }

  // Coordonnées : détection du système renvoyé par le serveur
  function toMerc(mode) {
    if (mode === 'merc') return (a, b) => [a, b];
    if (mode === 'l93') return (a, b) => { const ll = l93ToLonLat(a, b); return [mx(ll[0]), my(ll[1])]; };
    if (mode === 'latlon') return (a, b) => [mx(b), my(a)];
    return (a, b) => [mx(a), my(b)];
  }
  function firstCoord(geom) {
    let c = geom && geom.coordinates;
    while (Array.isArray(c) && Array.isArray(c[0])) c = c[0];
    return Array.isArray(c) && c.length >= 2 ? c : null;
  }
  function detectMode(fc, bb, hint) {
    const f = (fc.features || []).find(ft => firstCoord(ft.geometry));
    if (!f) return hint || 'merc';
    const [a, b] = firstCoord(f.geometry);
    const pad = Math.max(bb[2] - bb[0], bb[3] - bb[1]) * 3 + 20000;
    const ok = ([x, y]) => x > bb[0] - pad && x < bb[2] + pad && y > bb[1] - pad && y < bb[3] + pad;
    const crs = fc.crs && fc.crs.properties && String(fc.crs.properties.name || '');
    const order = [];
    if (/3857|900913/.test(crs)) order.push('merc');
    if (/2154/.test(crs)) order.push('l93');
    if (hint) order.push(hint);
    order.push('merc', 'l93', 'lonlat', 'latlon');
    for (const m of order) { const p = toMerc(m)(a, b); if (isFinite(p[0]) && isFinite(p[1]) && ok(p)) return m; }
    return order[0];
  }
  function prop(p, ...names) {
    if (!p) return undefined;
    for (const n of names) {
      if (p[n] != null) return p[n];
      const lo = n.toLowerCase(), up = n.toUpperCase();
      if (p[lo] != null) return p[lo];
      if (p[up] != null) return p[up];
    }
    return undefined;
  }
  function normalizeFeature(ft, conv) {
    const g = ft.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const rings = [], bb = [Infinity, Infinity, -Infinity, -Infinity];
    for (const poly of polys) for (const ring of poly) {
      if (!ring || ring.length < 4) continue;
      const a = new Float64Array(ring.length * 2);
      for (let i = 0; i < ring.length; i++) {
        const p = conv(ring[i][0], ring[i][1]);
        a[2 * i] = p[0]; a[2 * i + 1] = p[1];
        if (p[0] < bb[0]) bb[0] = p[0]; if (p[0] > bb[2]) bb[2] = p[0];
        if (p[1] < bb[1]) bb[1] = p[1]; if (p[1] > bb[3]) bb[3] = p[1];
      }
      rings.push(a);
    }
    if (!rings.length) return null;
    const pr = ft.properties || {};
    const code = prop(pr, 'code_tfv', 'CODE_TFV');
    let label = prop(pr, 'tfv', 'TFV', 'libelle', 'lib_tfv', 'formation');
    const ess = prop(pr, 'essence', 'ESSENCE', 'essence_dominante');
    if (code == null && label == null && ess == null) {
      const txt = Object.values(pr).filter(v => typeof v === 'string' && v.length > 3 && /for|bois|lande|herb|peupl|feuill|conif|pin|sapin|hetre|hêtre|chene|chêne/i.test(v));
      if (txt.length) label = txt.sort((a, b) => b.length - a.length)[0];
    }
    let id = ft.id != null ? ft.id : prop(pr, 'id', 'objectid', 'gid');
    if (id == null) id = String(code) + ':' + rings[0][0].toFixed(1) + ':' + rings[0][1].toFixed(1);
    return { id: String(id), code: code == null ? '' : String(code), label: label == null ? '' : String(label), ess: ess == null ? '' : String(ess), g: groupOf(code, label, ess), rings, bb };
  }

  function summarizeWeather(j, todayISO) {
    const d = j && j.daily;
    if (!d || !Array.isArray(d.time)) return null;
    let t = d.time.indexOf(todayISO);
    if (t < 0) t = Math.min(d.time.length - 1, 21);
    const P = d.precipitation_sum || [], Tm = d.temperature_2m_mean || [], Tn = d.temperature_2m_min || [], Tx = d.temperature_2m_max || [];
    const v = (a, i) => (i < 0 || i >= a.length || a[i] == null || isNaN(a[i])) ? null : +a[i];
    const mean = i => { let m = v(Tm, i); if (m == null) { const a = v(Tn, i), b = v(Tx, i); if (a != null && b != null) m = (a + b) / 2; } return m; };
    let r14 = 0, n14 = 0, r3 = 0, ts = 0, tn = 0, frost5 = 0, f7 = 0, fs = 0, fn = 0;
    for (let i = t - 14; i < t; i++) { const x = v(P, i); if (x != null) { r14 += x; n14++; if (i >= t - 3) r3 += x; } }
    for (let i = t - 7; i < t; i++) { const x = mean(i); if (x != null) { ts += x; tn++; } }
    for (let i = t - 5; i <= t; i++) { const x = v(Tn, i); if (x != null && x < -0.5) frost5++; }
    for (let i = t; i < t + 7 && i < d.time.length; i++) { const x = v(P, i); if (x != null) f7 += x; const y = mean(i); if (y != null) { fs += y; fn++; } }
    return { r14, r3, t7: tn ? ts / tn : null, frost5, f7, ft7: fn ? fs / fn : null, ok: n14 >= 10 };
  }

  function pousse(sp, wx, month) {
    const season = seasonOf(sp, month);
    if (!wx || !wx.ok) return { season, idx: null };
    const rf = Math.pow(clamp(wx.r14 / sp.w.rain, 0, 1), 0.8);
    const t = wx.t7;
    const tf = t == null ? 0.7 : t < sp.w.tlo ? clamp(1 - (sp.w.tlo - t) / 6, 0, 1) : t > sp.w.thi ? clamp(1 - (t - sp.w.thi) / 6, 0, 1) : 1;
    const ff = wx.frost5 >= 3 ? sp.w.frost * sp.w.frost : wx.frost5 >= 1 ? sp.w.frost : 1;
    return { season, rf, tf, ff, idx: season * rf * tf * ff };
  }
  function pousseLabel(r) {
    if (r.season <= 0) return { t: 'Hors saison', c: 'off' };
    if (r.idx == null) return { t: 'Météo ?', c: 'off' };
    if (r.idx >= 0.55) return { t: 'Pousse probable', c: 'good' };
    if (r.idx >= 0.3) return { t: 'Pousse possible', c: 'mid' };
    if (r.idx >= 0.1) return { t: 'Pousse faible', c: 'low' };
    return { t: 'Peu probable', c: 'low' };
  }

  return { R, HALF, mx, my, lonOf, latOf, clamp, l93ToLonLat, GROUPS, GKEYS, GIDX, TFV, groupOf, norm, LITHO, SPECIES, LEVELS,
    edgeF, cellGround, makeGrid, rasterize, pointInRings, chamfer, computeLayers, potentials, seasonOf, bestOf, levelOf,
    toMerc, detectMode, normalizeFeature, summarizeWeather, pousse, pousseLabel, prop };
})();
export default Core;
