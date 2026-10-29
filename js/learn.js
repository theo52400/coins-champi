// Onglet « Apprendre » : encyclopédie (45 fiches, photos libres), quiz, cartes mémoire, défi de la semaine, Mycodex.
import { ENCYCLO, BY_ID, CAT, NOTE, isEdible, MASTER_N, QUIZ_WEEK_PTS } from './encyclo.js';
import { isoWeek } from './game.js';

export const WEEK_N = 10, WEEK_PASS = 8;
const MOIS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Tirage reproductible (même défi pour tout le groupe pendant la semaine)
function rng(seed) { let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, r) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export function createLearn(x) {
  const { $, esc, store, S, MONTH, onPoints, openSpeciesMap, mycodexHtml, saveQuiz } = x;
  const dataUrl = x.dataUrl || (p => p);
  const L = { view: store.get('cc.learn', 'encyclo'), filter: 'tous', q: '', fiche: null, quiz: null, photos: null, photosSt: null, flash: store.get('cc.flash', {}) };

  // ---------- photos (data/encyclo/photos.json : crédits et nombre de photos par espèce) ----------
  function loadPhotos() {
    if (L.photosSt) return;
    L.photosSt = 'q';
    fetch(dataUrl('data/encyclo/photos.json')).then(r => (r.ok ? r.json() : null)).then(j => { L.photos = (j && j.sp) || {}; L.pv = (j && j.v) || '1'; L.photosSt = 'ok'; x.rerender(); })
      .catch(() => { L.photos = {}; L.photosSt = 'err'; });
  }
  const photos = id => (L.photos && L.photos[id]) || [];
  const thumb = (id, k) => { const p = photos(id)[k || 0]; return p ? dataUrl('data/encyclo/photos/' + p.t) + '?v=' + L.pv : null; };
  const big = (id, k) => { const p = photos(id)[k || 0]; return p ? dataUrl('data/encyclo/photos/' + p.f) + '?v=' + L.pv : null; };
  const imgOr = (src, alt, cls) => (src ? '<img loading="lazy" alt="' + esc(alt || '') + '" src="' + src + '"' + (cls ? ' class="' + cls + '"' : '') + '>' : '<span class="en-noimg' + (cls ? ' ' + cls : '') + '" aria-hidden="true"></span>');
  const badge = e => '<span class="en-badge ' + CAT[e.cat].cls + '">' + CAT[e.cat].n + '</span>';
  const stars = n => '<span class="en-stars" aria-label="Goût : ' + n + ' sur 5 (' + NOTE[n] + ')">' + '★★★★★'.slice(0, n) + '<i>' + '★★★★★'.slice(n) + '</i></span>';
  const inSeason = e => (e.m[MONTH] || 0) >= 0.5;

  // ---------- progression du quiz (profil du joueur) ----------
  const quizState = () => Object.assign({ m: {}, w: [] }, (S.me && S.me.quiz) || {});
  const mastered = q => Object.keys(q.m).filter(k => q.m[k] >= MASTER_N && BY_ID[k]);

  // ---------- rendu ----------
  function render(el) {
    loadPhotos();
    const tabs = '<div class="learn-tabs seg" role="tablist">' + [['encyclo', 'Encyclopédie'], ['quiz', 'Quiz'], ['dex', 'Mycodex']].map(([v, n]) =>
      '<button role="tab" data-act="learn-tab" data-v="' + v + '" aria-selected="' + (L.view === v) + '">' + n + '</button>').join('') + '</div>';
    let body;
    if (L.view === 'quiz') body = L.quiz ? quizHtml() : quizHub();
    else if (L.view === 'dex') body = mycodexHtml();
    else body = L.fiche ? ficheHtml(BY_ID[L.fiche]) : listHtml();
    el.innerHTML = tabs + body;
    const q = el.querySelector('#en-q');
    if (q) {
      q.value = L.q;
      q.addEventListener('input', () => { L.q = q.value; const g = el.querySelector('#en-grid'); if (g) g.innerHTML = cards(); });
    }
  }
  function filtered() {
    const q = norm(L.q).trim();
    return ENCYCLO.filter(e => (L.filter === 'tous' || (L.filter === 'bons' && isEdible(e)) || (L.filter === 'danger' && e.cat !== 'c') || (L.filter === 'saison' && inSeason(e))) &&
      (!q || norm(e.n + ' ' + e.lat + ' ' + (e.alias || '')).includes(q)));
  }
  function cards() {
    const list = filtered();
    if (!list.length) return '<p class="note">Aucune fiche ne correspond.</p>';
    return list.map(e => '<button class="en-card" data-act="en-open" data-id="' + e.id + '">' + imgOr(thumb(e.id), '') +
      '<span class="en-card-t"><b>' + esc(e.n) + '</b>' + badge(e) + (e.note ? stars(e.note) : '') + '</span></button>').join('');
  }
  function listHtml() {
    const nb = ENCYCLO.filter(isEdible).length;
    return '<h2>Encyclopédie</h2><p class="lead">' + ENCYCLO.length + ' champignons à connaître : ' + nb + ' bons comestibles et ' + (ENCYCLO.length - nb) + ' espèces dangereuses ou sans intérêt.</p>' +
      '<input class="input" id="en-q" type="search" placeholder="Cèpe, girolle, Amanita…" autocomplete="off" aria-label="Chercher un champignon">' +
      '<div class="chips" role="group" aria-label="Filtrer">' + [['tous', 'Tous'], ['bons', 'Comestibles'], ['danger', 'Dangereux'], ['saison', 'De saison']].map(([v, n]) =>
        '<button class="chip" data-act="en-filter" data-v="' + v + '" aria-pressed="' + (L.filter === v) + '">' + n + '</button>').join('') + '</div>' +
      '<div class="en-grid" id="en-grid">' + cards() + '</div>' +
      '<div class="warnbox"><b>Ne mangez jamais un champignon sur la foi d\'une photo ou d\'une fiche.</b> Faites vérifier votre panier par un pharmacien ou une société mycologique. Les champignons sauvages se mangent toujours cuits (20 à 30 minutes à la poêle), jamais crus. En cas de malaise après un repas de champignons : 15 ou 112.</div>' +
      offlineCard();
  }
  function offlineCard() {
    const n = Object.values(L.photos || {}).reduce((a, l) => a + l.length, 0);
    if (!n) return '';
    return '<div class="card en-c"><h3>Sans réseau</h3><p class="note" style="margin:0 0 10px">Les fiches sont déjà dans l\'appli. Gardez aussi les ' + n + ' photos pour les consulter en forêt.</p><button class="btn small" data-act="en-offline">Garder les photos</button> <span class="note" id="en-off-st"></span></div>';
  }
  function frise(e) {
    return '<div class="frise" aria-label="Saison">' + MOIS.map((m, i) => { const v = e.m[i + 1] || 0; return '<span class="' + (i + 1 === MONTH ? 'now' : '') + '" title="' + MOIS_LONG[i] + '"><i style="opacity:' + (v ? 0.25 + 0.75 * v : 0) + '"></i>' + m + '</span>'; }).join('') + '</div>';
  }
  function ficheHtml(e) {
    if (!e) { L.fiche = null; return listHtml(); }
    const ph = photos(e.id);
    const car = ph.length ? '<div class="en-carousel">' + ph.map((p, k) => '<figure>' + imgOr(big(e.id, k), e.n) + '<figcaption>Photo : ' + esc(p.a) + ' · ' + esc(p.l) + ' · <a href="' + esc(p.u) + '" target="_blank" rel="noopener">Wikimedia Commons</a></figcaption></figure>').join('') + '</div>'
      : '<div class="en-carousel"><figure>' + imgOr(null) + '<figcaption>' + (L.photosSt === 'q' ? 'Chargement des photos…' : 'Photo à venir') + '</figcaption></figure></div>';
    const dex = e.game && S.prof && S.prof.stats && S.prof.stats.perSpecies ? (S.prof.stats.perSpecies[e.game] ? '<span class="tag ok">Dans ton Mycodex</span>' : '<span class="tag">Pas encore trouvé</span>') : '';
    let h = '<button class="linkish en-back" data-act="en-back">‹ Encyclopédie</button>' + car +
      '<div><h2>' + esc(e.n) + '</h2><div class="latin">' + esc(e.lat) + '</div>' + (e.alias ? '<p class="note" style="margin:0">Aussi appelé : ' + esc(e.alias) + '</p>' : '') + '</div>' +
      '<div class="en-head">' + badge(e) + (e.note ? stars(e.note) + '<span class="note">' + NOTE[e.note] + '</span>' : '') + dex + '</div>';
    if (e.tox) h += '<div class="warnbox ' + (e.cat === 'e' ? '' : 'danger') + '"><b>' + (e.cat === 'm' ? 'Mortel. ' : e.cat === 't' ? 'Toxique. ' : '') + '</b>' + esc(e.tox) + (e.cat === 'm' || e.cat === 't' ? '<br><b>En cas de doute après un repas : 15 ou 112, et gardez les restes du plat.</b>' : '') + '</div>';
    if (e.cat === 'c') h += '<div class="card en-c"><h3>Au goût</h3><p>' + esc(e.gout) + '</p><h3>En cuisine</h3><p>' + esc(e.cuisine) + '</p><h3>Conservation</h3><p>' + esc(e.conserv) + '</p></div>';
    h += '<div class="card en-c"><h3>Le reconnaître</h3><dl class="kv en-kv">' + e.crit.map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>').join('') + '</dl></div>';
    h += '<div class="card en-c"><h3>Où et quand</h3><p>' + esc(e.hab) + '</p>' + frise(e) + (e.map ? '<div class="actions"><button class="btn primary" data-act="en-map" data-id="' + e.map + '">Voir ses coins sur la carte</button></div>' : '') + '</div>';
    if (e.sosies && e.sosies.length) {
      h += '<div class="card en-c"><h3>Ne pas confondre avec</h3>' + e.sosies.map(([id, t]) => {
        const o = id && BY_ID[id];
        return '<div class="vs">' + (o ? '<div class="vs-pair"><figure>' + imgOr(thumb(e.id), e.n) + '<figcaption>' + esc(e.n) + ' ' + badge(e) + '</figcaption></figure><span class="vs-x">≠</span><button class="vs-o" data-act="en-open" data-id="' + o.id + '"><figure>' + imgOr(thumb(o.id), o.n) + '<figcaption>' + esc(o.n) + ' ' + badge(o) + '</figcaption></figure></button></div>' : '') + '<p>' + esc(t) + '</p></div>';
      }).join('') + '</div>';
    }
    if (e.fait) h += '<div class="card en-c en-fait"><h3>Le saviez-vous ?</h3><p>' + esc(e.fait) + '</p></div>';
    h += '<p class="note">Une fiche ne remplace pas l\'avis d\'un connaisseur : faites toujours vérifier votre cueillette.</p>';
    return h;
  }

  // ---------- quiz ----------
  function quizHub() {
    const q = quizState(), m = mastered(q).length, wk = isoWeek(new Date()).key, done = q.w.includes(wk);
    const ready = L.photosSt === 'ok' && Object.keys(L.photos || {}).length > 10;
    const deadly = ENCYCLO.filter(e => e.cat === 'm'), dm = deadly.filter(e => (q.m[e.id] || 0) >= MASTER_N).length;
    return '<h2>Quiz</h2><p class="lead">Apprenez à reconnaître les champignons en photo. Une espèce est maîtrisée après ' + MASTER_N + ' bonnes réponses.</p>' +
      '<div class="card"><div class="chal-head"><b>Espèces maîtrisées</b><span>' + m + ' / ' + ENCYCLO.length + '</span></div><div class="progress" style="margin-top:8px"><b style="width:' + Math.round(100 * m / ENCYCLO.length) + '%"></b></div>' +
      '<p class="note" style="margin:8px 0 0">Dont mortelles : ' + dm + ' / ' + deadly.length + '. Chaque espèce maîtrisée rapporte 5 points.</p></div>' +
      (ready ? '' : '<p class="note">' + (L.photosSt === 'q' ? 'Chargement des photos…' : 'Les photos ne sont pas disponibles pour le moment.') + '</p>') +
      '<div class="qz-modes">' +
      '<button class="card qz-mode" data-act="qz-start" data-v="week"' + (ready ? '' : ' disabled') + '><b>Défi de la semaine</b><span>' + WEEK_N + ' photos, les mêmes pour tout le groupe. ' + WEEK_PASS + ' bonnes réponses : +' + QUIZ_WEEK_PTS + ' points.</span>' + (done ? '<span class="tag ok">Réussi cette semaine</span>' : '') + '</button>' +
      '<button class="card qz-mode" data-act="qz-start" data-v="name"' + (ready ? '' : ' disabled') + '><b>Quel est ce champignon ?</b><span>10 photos, 4 propositions, souvent des sosies.</span></button>' +
      '<button class="card qz-mode" data-act="qz-start" data-v="eat"' + (ready ? '' : ' disabled') + '><b>Comestible ou dangereux ?</b><span>10 photos : à vous de trier le panier.</span></button>' +
      '<button class="card qz-mode" data-act="qz-start" data-v="flash"' + (ready ? '' : ' disabled') + '><b>Cartes mémoire</b><span>Retournez la carte, dites si vous saviez. Les espèces à revoir reviennent plus souvent.</span></button>' +
      '</div>';
  }
  const withPhotos = () => ENCYCLO.filter(e => photos(e.id).length);
  function makeQuiz(mode) {
    const wk = isoWeek(new Date()).key, r = mode === 'week' ? rng('coins-champi-' + wk) : Math.random;
    const pool = withPhotos();
    if (mode === 'flash') {
      const w = e => 1 + 4 * ((L.flash[e.id] || 0) < 1) + 2 * (e.cat === 'm');
      const deck = []; const bag = pool.slice();
      while (deck.length < Math.min(12, pool.length) && bag.length) { let t = bag.reduce((a, e) => a + w(e), 0) * r(); const i = bag.findIndex(e => (t -= w(e)) <= 0); deck.push(bag.splice(Math.max(0, i), 1)[0]); }
      return { mode, i: 0, items: deck.map(e => ({ id: e.id, k: Math.floor(r() * Math.min(2, photos(e.id).length)) })), flipped: false, ok: 0 };
    }
    const n = mode === 'week' ? WEEK_N : 10;
    let picks = shuffle(pool, r).slice(0, n);
    if (mode === 'eat') { // équilibre : moitié comestibles, moitié non
      const a = shuffle(pool.filter(isEdible), r).slice(0, n / 2), b = shuffle(pool.filter(e => !isEdible(e)), r).slice(0, n / 2);
      picks = shuffle(a.concat(b), r);
    }
    const items = picks.map(e => {
      const k = Math.floor(r() * Math.min(2, photos(e.id).length));
      if (mode === 'eat') return { id: e.id, k, choices: ['c', 'x'], good: isEdible(e) ? 'c' : 'x' };
      const sos = (e.sosies || []).map(s => s[0]).filter(id => id && photos(id).length);
      const same = shuffle(pool.filter(o => o.id !== e.id && !sos.includes(o.id) && (o.cat === 'c') === (e.cat === 'c')), r);
      const others = shuffle(pool.filter(o => o.id !== e.id && !sos.includes(o.id)), r);
      const ch = [e.id]; for (const id of sos.concat(same.map(o => o.id), others.map(o => o.id))) { if (ch.length >= 4) break; if (!ch.includes(id) && !(id.startsWith('cepe') && e.id.startsWith('cepe'))) ch.push(id); }
      return { id: e.id, k, choices: shuffle(ch, r), good: e.id };
    });
    return { mode, wk, i: 0, items, answered: null, ok: 0, gained: [] };
  }
  function quizHtml() {
    const z = L.quiz;
    if (z.mode === 'flash') return flashHtml(z);
    if (z.i >= z.items.length) return resultHtml(z);
    const it = z.items[z.i], e = BY_ID[it.id], ans = z.answered;
    const title = { week: 'Défi de la semaine', name: 'Quel est ce champignon ?', eat: 'Comestible ou dangereux ?' }[z.mode];
    let h = '<div class="qz-top"><button class="linkish" data-act="qz-quit">‹ Quitter</button><span class="note">' + title + ' · ' + (z.i + 1) + ' / ' + z.items.length + '</span></div>' +
      '<div class="progress"><b style="width:' + Math.round(100 * z.i / z.items.length) + '%"></b></div>' +
      '<figure class="qz-photo">' + imgOr(big(it.id, it.k), 'Photo à identifier') + '</figure><div class="qz-choices">';
    const lab = c => (z.mode === 'eat' ? (c === 'c' ? 'Comestible' : 'À laisser (toxique ou sans intérêt)') : esc(BY_ID[c].n));
    it.choices.forEach((c, i) => {
      const cls = ans == null ? '' : c === it.good ? ' good' : i === ans ? ' bad' : ' dim';
      h += '<button class="btn qz-c' + cls + '" data-act="qz-ans" data-i="' + i + '"' + (ans == null ? '' : ' disabled') + '>' + lab(c) + '</button>';
    });
    h += '</div>';
    if (ans != null) {
      const right = it.choices[ans] === it.good;
      h += '<div class="warnbox ' + (right ? 'okbox' : 'danger') + '"><b>' + (right ? 'Bien vu !' : 'Raté.') + '</b> Réponse : <b>' + esc(e.n) + '</b> ' + badge(e) + '. ' +
        esc(e.cat === 'c' ? (e.crit[1] ? e.crit[1][0] + ' : ' + e.crit[1][1] : '') : (e.tox || '').split('. ')[0] + '.') + '</div>' +
        '<div class="actions"><button class="btn" data-act="en-open-from-quiz" data-id="' + e.id + '">Voir la fiche</button><button class="btn primary" data-act="qz-next">' + (z.i + 1 >= z.items.length ? 'Résultat' : 'Suivante') + '</button></div>';
    }
    return h;
  }
  function resultHtml(z) {
    const n = z.items.length, wkPass = z.mode === 'week' && z.ok >= WEEK_PASS;
    return '<div class="qz-top"><button class="linkish" data-act="qz-quit">‹ Quiz</button></div><div class="card qz-res"><h2>' + z.ok + ' / ' + n + '</h2><p>' +
      (z.ok === n ? 'Parfait, œil de mycologue !' : z.ok >= n * 0.7 ? 'Très bien !' : z.ok >= n * 0.4 ? 'Pas mal : relisez les fiches des espèces ratées.' : 'Continuez à vous entraîner avec les cartes mémoire.') + '</p>' +
      (z.mode === 'week' ? '<p class="note">' + (wkPass ? (z.weekNew ? 'Défi réussi : +' + QUIZ_WEEK_PTS + ' points !' : 'Défi déjà réussi cette semaine.') : 'Il faut ' + WEEK_PASS + ' bonnes réponses pour réussir le défi. Vous pouvez réessayer.') + '</p>' : '') +
      (z.gained.length ? '<p class="note">Nouvelles espèces maîtrisées : ' + z.gained.map(id => esc(BY_ID[id].n)).join(', ') + '.</p>' : '') +
      '<div class="actions"><button class="btn primary" data-act="qz-start" data-v="' + z.mode + '">Rejouer</button><button class="btn" data-act="qz-quit">Autres quiz</button></div></div>' +
      '<div class="card en-c"><h3>Les réponses</h3><div class="list">' + z.items.map(it => { const e = BY_ID[it.id]; return '<button class="li" data-act="en-open-from-quiz" data-id="' + e.id + '">' + imgOr(thumb(e.id, it.k)) + '<div class="grow">' + esc(e.n) + ' ' + badge(e) + '<small>' + (it.right ? 'Bonne réponse' : 'Raté') + '</small></div></button>'; }).join('') + '</div></div>';
  }
  function flashHtml(z) {
    if (z.i >= z.items.length) return '<div class="qz-top"><button class="linkish" data-act="qz-quit">‹ Quiz</button></div><div class="card qz-res"><h2>' + z.ok + ' / ' + z.items.length + '</h2><p>cartes connues. Les autres reviendront plus souvent.</p><div class="actions"><button class="btn primary" data-act="qz-start" data-v="flash">Nouvelle série</button><button class="btn" data-act="qz-quit">Autres quiz</button></div></div>';
    const it = z.items[z.i], e = BY_ID[it.id];
    return '<div class="qz-top"><button class="linkish" data-act="qz-quit">‹ Quitter</button><span class="note">Cartes mémoire · ' + (z.i + 1) + ' / ' + z.items.length + '</span></div>' +
      '<button class="fc' + (z.flipped ? ' flipped' : '') + '" data-act="fc-flip" aria-label="Retourner la carte"><span class="fc-front">' + imgOr(big(it.id, it.k), 'Photo') + '<span class="fc-hint">Touchez pour voir la réponse</span></span>' +
      '<span class="fc-back"><b>' + esc(e.n) + '</b><i>' + esc(e.lat) + '</i>' + badge(e) + (e.note ? stars(e.note) : '') + '<span>' + esc(e.crit.slice(0, 2).map(c => c[0] + ' : ' + c[1]).join(' ')) + '</span></span></button>' +
      (z.flipped ? '<div class="actions"><button class="btn" data-act="fc-again">À revoir</button><button class="btn primary" data-act="fc-ok">Je savais</button></div>' : '');
  }
  function answer(i) {
    const z = L.quiz, it = z.items[z.i]; if (!it || z.answered != null) return;
    z.answered = +i; it.right = it.choices[+i] === it.good;
    if (it.right) {
      z.ok++;
      if (z.mode !== 'eat') {
        const q = quizState(), before = q.m[it.id] || 0;
        if (before < MASTER_N) { q.m[it.id] = before + 1; if (q.m[it.id] >= MASTER_N) z.gained.push(it.id); z.dirty = q; S.me = Object.assign({}, S.me || {}, { quiz: q }); }
      }
    }
  }
  function next() {
    const z = L.quiz; z.i++; z.answered = null;
    if (z.i >= z.items.length) finish(z);
  }
  function finish(z) {
    let q = z.dirty || null, pts = 5 * z.gained.length;
    if (z.mode === 'week' && z.ok >= WEEK_PASS) {
      q = q || quizState();
      if (!q.w.includes(z.wk)) { q.w = q.w.concat([z.wk]).slice(-60); z.weekNew = true; pts += QUIZ_WEEK_PTS; S.me = Object.assign({}, S.me || {}, { quiz: q }); }
    }
    if (q) saveQuiz(q);
    if (pts) onPoints(pts, z.weekNew ? 'Défi de la semaine réussi' : 'Nouvelles espèces maîtrisées');
  }

  // ---------- actions ----------
  function act(a, t) {
    switch (a) {
      case 'learn-tab': L.view = t.dataset.v; store.set('cc.learn', L.view); if (L.view !== 'quiz') L.quiz = null; return 'top';
      case 'en-filter': L.filter = t.dataset.v; return 'keep';
      case 'en-open': L.view = 'encyclo'; L.fiche = t.dataset.id; return 'top';
      case 'en-open-from-quiz': L.ficheFromQuiz = L.quiz; L.quiz = null; L.view = 'encyclo'; L.fiche = t.dataset.id; return 'top';
      case 'en-back': if (L.ficheFromQuiz) { L.quiz = L.ficheFromQuiz; L.ficheFromQuiz = null; L.view = 'quiz'; } L.fiche = null; return 'top';
      case 'en-map': openSpeciesMap(t.dataset.id); return 'none';
      case 'en-offline': offline(); return 'none';
      case 'qz-start': L.view = 'quiz'; L.quiz = makeQuiz(t.dataset.v); return 'top';
      case 'qz-ans': answer(t.dataset.i); return 'keep';
      case 'qz-next': next(); return 'top';
      case 'qz-quit': L.quiz = null; return 'top';
      case 'fc-flip': if (L.quiz) L.quiz.flipped = !L.quiz.flipped; return 'keep';
      case 'fc-ok': case 'fc-again': {
        const z = L.quiz, it = z.items[z.i]; const v = L.flash[it.id] || 0;
        L.flash[it.id] = a === 'fc-ok' ? Math.min(5, v + 1) : 0; store.set('cc.flash', L.flash);
        if (a === 'fc-ok') z.ok++;
        z.i++; z.flipped = false; return 'keep';
      }
    }
    return null;
  }
  async function offline() {
    const st = $('#en-off-st'), urls = [];
    for (const id of Object.keys(L.photos || {})) photos(id).forEach((p, k) => { urls.push(big(id, k), thumb(id, k)); });
    let done = 0;
    for (let i = 0; i < urls.length; i += 6) {
      await Promise.all(urls.slice(i, i + 6).map(u => fetch(u).then(r => r.blob()).catch(() => null)));
      done = Math.min(urls.length, i + 6); if (st) st.textContent = done + ' / ' + urls.length;
    }
    if (st) st.textContent = 'Photos gardées pour le hors-ligne.';
  }
  return {
    render, act, L,
    openFiche(id) { L.view = 'encyclo'; L.fiche = id; L.quiz = null; },
    ficheForGame(gid) { const e = ENCYCLO.find(x2 => x2.game === gid); return e ? e.id : null; }
  };
}
