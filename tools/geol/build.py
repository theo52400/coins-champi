#!/usr/bin/env python3
"""Sous-sol de la France pour Coins à champi.

Source : carte géologique de la France au 1/1 000 000 (BRGM, 2017, licence CC BY 4.0), lue dans les tuiles
vectorielles de Macrostrat (couche « carto » ; source 249 en France, cartes voisines aux frontières).

Sortie, dans le dossier donné en argument :
  {lat}_{lon}.bin.gz  tuile de 1° x 1°, 200 x 200 cases de 0,005°, un entier 16 bits (petit-boutiste) par case,
                      ligne 0 au nord ; la valeur est un numéro de légende, 0 = pas de donnée
  index.json          {"v", "n", "src", "tiles": [[lat, lon], ...], "legend": [null, [classe, roche, âge], ...]}
Classes de sol du modèle : 1 acide, 2 intermédiaire, 3 calcaire, 4 argileux (0 inconnu).

Lancé par .github/workflows/geol-france.yml (les machines de GitHub ont accès à Internet).
Pour un essai hors réseau : --from-dir DOSSIER lit DOSSIER/{z}/{x}/{y}.mvt.
"""
import argparse
import gzip
import struct
import zlib
import hashlib
import json
import math
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

import numpy as np
import mapbox_vector_tile as mvt

N = 200                                    # cases par degré (0,005°)
LON0, LON1, LAT0, LAT1 = -6, 10, 41, 52    # emprise de la grille nationale, en degrés entiers
W, H = (LON1 - LON0) * N, (LAT1 - LAT0) * N
BBOX = (-5.5, 41.25, 10.0, 51.25)          # France métropolitaine et Corse, avec les frontières
URL = 'https://tiles.macrostrat.org/carto/{z}/{x}/{y}.mvt'
UA = 'CoinsAChampi/1.0 (+https://github.com/theo52400/coins-champi)'
SRC = 'Carte géologique de la France au 1/1 000 000 (BRGM, 2017) via Macrostrat, CC BY 4.0'

# ---------------------------------------------------------------------------------------------------------
# Familles de roches : motif (texte anglais en minuscules), clé, libellé français, classe de sol, générique.
# Dans un terme composé (« marly limestone »), le nom principal est le dernier : on garde la correspondance
# qui finit le plus à droite, et à égalité la plus longue. Les familles génériques ne servent qu'à défaut.
FAMILIES = [
    (r'\bwater\b|\blakes?\b|glacier|\bice\b', 'eau', None, 0, False),
    (r'\bpeat|\bbog\b', 'tourbe', 'tourbe', 1, False),
    (r'\bcoal|lignite', 'charbon', 'charbon', 1, False),
    (r'calc-?schists?|calcschists?|schistes? lustr|calcareous (?:phyllites?|schists?|slates?)', 'calcschiste', 'calcschistes', 3,
     False),
    (r'\bmarl(?:y)? (?:schists?|slates?|shales?)', 'marne', 'marnes', 4, False),
    (r'mica[ -]?schists?', 'micaschiste', 'micaschistes', 1, False),
    (r'schists?\b', 'schiste', 'schistes', 1, False),
    (r'\bslates?\b|phyllites?|phyllades?', 'ardoise', 'schistes ardoisiers', 1, False),
    (r'orthogneiss|paragneiss|gneiss', 'gneiss', 'gneiss', 1, False),
    (r'migmatites?|anatexites?', 'migmatite', 'migmatites', 1, False),
    (r'granulites?', 'granulite', 'granulites', 1, False),
    (r'leucogranites?|monzogranites?|syenogranites?|granodiorites?|granites?|granitoids?|tonalites?|aplites?'
     r'|pegmatites?|acidic igneous|acid igneous|felsic', 'granite', 'granite', 1, False),
    (r'rhyolites?|dacites?|ignimbrites?|porphyr\w*|microgranites?', 'rhyolite', 'rhyolites', 1, False),
    (r'quartzites?', 'quartzite', 'quartzites', 1, False),
    (r'gr[ae]ywackes?|\bwackes?\b', 'grauwacke', 'grauwackes', 1, False),
    (r'arkoses?', 'arkose', 'arkoses', 1, False),
    (r'sandstones?|\bgrits?\b', 'gres', 'grès', 1, False),
    (r'conglomerates?|puddingstones?', 'conglomerat', 'conglomérats', 1, False),
    (r'breccias?', 'breche', 'brèches', 2, False),
    (r'\bcherts?\b|\bflints?\b|radiolarites?|siliceous|silcretes?|millstone|diatomites?', 'silex', 'silex', 1, False),
    (r'\bsands?\b|\bsandy\b', 'sable', 'sables', 1, False),
    (r'gravels?|pebbles?|cobbles?|boulders?', 'graviers', 'graviers', 2, False),
    (r'\bloess|\bloams?\b|\bloamy\b', 'limons', 'limons', 2, False),
    (r'\bsilts?\b', 'limons', 'limons', 2, False),
    (r'siltstones?|\bsilty\b', 'siltite', 'siltites', 2, False),
    (r'alluvi\w*|fluvial|fluviatile', 'alluvions', 'alluvions', 2, False),
    (r'colluvi\w*|slope deposits?|\bscree|\btalus\b|solifluction', 'colluvions', 'éboulis et colluvions', 2, False),
    (r'\btills?\b|tillites?|moraines?|morainic|diamict\w*|glacial|glacio\w*|fluvioglacial', 'moraines',
     'dépôts glaciaires', 2, False),
    (r'travertines?|\btufa\b|calcareous tuff', 'tuf', 'tuf calcaire', 3, False),
    (r'\bchalks?\b', 'craie', 'craie', 3, False),
    (r'marbles?', 'marbre', 'marbres', 3, False),
    (r'dolomites?|dolostones?|dolomitic rocks?', 'dolomie', 'dolomies', 3, False),
    (r'impure carbonates?', 'calcaire_marneux', 'calcaires marneux', 3, False),
    (r'limestones?|carbonates?|calcarenites?|oolit\w*|calcareous rocks?|bioclastic', 'calcaire', 'calcaires', 3, False),
    (r'evaporites?|gypsum|anhydrite|rock salt|\bsalt\b|halite', 'gypse', 'gypse', 3, False),
    (r'\bmarls?\b|marlstones?|\bmarly\b', 'marne', 'marnes', 4, False),
    (r'claystones?|mudstones?|argillites?|pelites?|mudrocks?|\bmuds?\b|\bclays?\b|\bclayey\b', 'argile', 'argiles',
     4, False),
    (r'shales?', 'schiste_arg', 'schistes argileux', 4, False),
    (r'basalts?|basanites?|dolerites?|diabases?|spilites?|basic igneous|\bmafic', 'basalte', 'basaltes', 2, False),
    (r'andesites?|trachytes?|trachytoids?|phonolites?|trachyandesites?|intermediate composition igneous|\blavas?\b', 'lave',
     'laves', 2, False),
    (r'\btuffs?\b|tuffites?|tephra|pyroclast\w*|volcanic|cinders?|scoria|\bash\b|fragmental igneous', 'tuf_volc',
     'roches volcaniques', 2, False),
    (r'siliciclastic', 'siliciclastique', 'roches détritiques siliceuses', 1, False),
    (r'gabbros?|norites?', 'gabbro', 'gabbros', 2, False),
    (r'diorites?|monzonites?|syenites?', 'diorite', 'diorites', 2, False),
    (r'amphibolites?|eclogites?|greenstones?|metabasites?|prasinites?|ophiolit\w*', 'amphibolite', 'amphibolites',
     2, False),
    (r'serpentin\w*|peridotites?|ultramafic|ultrabasic|dunites?|harzburgites?|lherzolites?', 'serpentinite',
     'serpentinites', 2, False),
    # génériques
    (r'hornfels|mylonit\w*|cataclas\w*|metamorphic|metasediment\w*|crystalline', 'metamorphique',
     'roches métamorphiques', 1, True),
    (r'plutonic|igneous|intrusive|granular', 'magmatique', 'roches magmatiques', 1, True),
    (r'clastic|sediments?|sedimentary|detrital|unconsolidated|deposits?|\bmixed\b|superficial', 'detritique',
     'dépôts', 2, True),
]
FAM_RE = [(re.compile(p), k, lab, c, g) for p, k, lab, c, g in FAMILIES]
FAM_BY_KEY = {k: (lab, c) for _, k, lab, c, _ in FAMILIES}
UNKNOWN_TERMS = Counter()
TERM_FAMILY = Counter()


def family_of(term):
    """Famille d'un terme lithologique anglais, ou None."""
    t = term.lower()
    best = None
    for generic_pass in (False, True):
        for rx, key, _lab, _c, generic in FAM_RE:
            if generic != generic_pass:
                continue
            for m in rx.finditer(t):
                cand = (m.end(), m.end() - m.start(), key)
                if best is None or cand[:2] > best[:2]:
                    best = cand
        if best:
            return best[2]
    return None


PCT = re.compile(r'\[\s*([\d.]+)\s*%?\s*\.\.\s*([\d.]+)\s*%?\s*\]')


def split_terms(lith):
    """Liste de (terme, poids) d'après le champ « lith » de Macrostrat, quel que soit son format."""
    s = (lith or '').strip()
    if not s:
        return []
    if PCT.search(s):                      # carte de France : « sandstone [50.0%..95.0%]; clay [5.0%..50.0%] »
        out = []
        for part in s.split(';'):
            m = PCT.search(part)
            name = PCT.sub('', part).strip(' ,.')
            if not name:
                continue
            out.append((name, (float(m.group(1)) + float(m.group(2))) / 2 if m else 50.0))
        return out
    maj = re.search(r'major\s*:?\s*\{([^}]*)\}', s, re.I)
    if maj:                                # « Major:{claystone}, Minor{limestone,sandstone} »
        out = []
        for grp, share in (('major', 70.0), ('minor', 25.0), ('incidental', 5.0)):
            m = re.search(grp + r'\s*:?\s*\{([^}]*)\}', s, re.I)
            if not m:
                continue
            items = [x.strip() for x in m.group(1).split(',') if x.strip()]
            out += [(x, share / len(items)) for x in items]
        return out
    # texte libre : « Claystone, marlstone with layers of sandstone, dolomite and limestone »
    parts = [p.strip() for p in re.split(r'[,;/()]|\band\b|\bor\b|\bwith\b|\bwithin\b|\bincluding\b', s, flags=re.I)]
    parts = [p for p in parts if p and len(p) > 2]
    return [(p, 1.0 / (i + 1)) for i, p in enumerate(parts)]


def decide(frac):
    """Classe de sol d'après les parts de chaque classe dans l'unité géologique."""
    order = sorted(((frac.get(c, 0.0), -i, c) for i, c in enumerate((1, 3, 4, 2))), reverse=True)
    (fb, _, b), (fs, _, s) = order[0], order[1]
    if fb <= 0:
        return 0
    if fb >= 0.6:
        return b
    if {b, s} == {1, 3} and fs >= 0.25:     # roches acides et calcaires mêlées
        return 2
    return b if fb >= 0.4 else 2


# Âges : anglais -> français (l'adjectif suit le nom en français : « Lower Triassic » -> « Trias inférieur »)
PERIODS = {
    'precambrian': 'Précambrien', 'archean': 'Archéen', 'proterozoic': 'Protérozoïque',
    'paleoproterozoic': 'Paléoprotérozoïque', 'mesoproterozoic': 'Mésoprotérozoïque',
    'neoproterozoic': 'Néoprotérozoïque', 'phanerozoic': 'Phanérozoïque', 'paleozoic': 'Paléozoïque',
    'palaeozoic': 'Paléozoïque', 'mesozoic': 'Mésozoïque', 'cenozoic': 'Cénozoïque', 'cambrian': 'Cambrien',
    'ordovician': 'Ordovicien', 'silurian': 'Silurien', 'devonian': 'Dévonien', 'carboniferous': 'Carbonifère',
    'mississippian': 'Carbonifère inférieur', 'pennsylvanian': 'Carbonifère supérieur', 'permian': 'Permien',
    'triassic': 'Trias', 'jurassic': 'Jurassique', 'cretaceous': 'Crétacé', 'tertiary': 'Tertiaire',
    'paleogene': 'Paléogène', 'palaeogene': 'Paléogène', 'neogene': 'Néogène', 'quaternary': 'Quaternaire',
    'paleocene': 'Paléocène', 'eocene': 'Éocène', 'oligocene': 'Oligocène', 'miocene': 'Miocène',
    'pliocene': 'Pliocène', 'pleistocene': 'Pléistocène', 'holocene': 'Holocène', 'lias': 'Lias',
    'liassic': 'Lias', 'dogger': 'Dogger', 'malm': 'Malm', 'stephanian': 'Stéphanien',
    'westphalian': 'Westphalien', 'namurian': 'Namurien', 'visean': 'Viséen', 'tournaisian': 'Tournaisien',
    'autunian': 'Autunien', 'saxonian': 'Saxonien', 'variscan': 'hercynien', 'hercynian': 'hercynien',
    'cadomian': 'cadomien', 'gelasian': 'Pléistocène inférieur', 'calabrian': 'Pléistocène inférieur',
    'ionian': 'Pléistocène moyen', 'tarantian': 'Pléistocène supérieur',
}
QUAL = {'lower': 'inférieur', 'early': 'inférieur', 'middle': 'moyen', 'upper': 'supérieur', 'late': 'supérieur'}
# étages régionaux (frontière allemande, Bassin houiller) : déjà situés dans leur période
STAGES = {
    'buntsandstein': 'Buntsandstein', 'muschelkalk': 'Muschelkalk', 'keuper': 'Keuper', 'lettenkohle': 'Lettenkohle',
    'rotliegend': 'Permien inférieur', 'rotliegendes': 'Permien inférieur', 'zechstein': 'Permien supérieur',
}


def age_fr(age):
    """« Lower Triassic » -> « Trias inférieur » ; « Upper Jurassic - Lower Cretaceous » -> « Jurassique supérieur à
    Crétacé inférieur » ; chaîne vide si l'âge n'est pas reconnu (plutôt que de le laisser en anglais)."""
    if not age:
        return ''
    out = []
    for piece in re.split(r'\s+-\s+|\s+to\s+|\s*/\s*', age.strip()):
        words = [w.lower() for w in re.split(r'[\s,;()]+', piece.strip()) if w]
        lab = None
        for i, w in enumerate(words):
            if w in STAGES or w in PERIODS:
                base = STAGES.get(w) or PERIODS[w]
                q = QUAL.get(words[i - 1]) if i > 0 else None
                lab = base + (' ' + q if q and ' ' not in base else '')
                if w in STAGES:
                    break                  # l'étage est plus précis que la période qui le précède
                if not any(x in STAGES for x in words[i + 1:]):
                    break
        if lab and lab not in out:
            out.append(lab)
    out = out[:2]
    # « Viséen à Carbonifère » : la période englobe déjà l'étage
    if len(out) == 2 and (PARENT.get(out[0].split(' ')[0]) == out[1] or PARENT.get(out[1].split(' ')[0]) == out[0]):
        out = [out[0] if PARENT.get(out[0].split(' ')[0]) == out[1] else out[1]]
    # « Dévonien moyen à Dévonien supérieur » -> « Dévonien moyen à supérieur »
    if len(out) == 2:
        a, b = out[0].split(' '), out[1].split(' ')
        if len(a) == 2 and len(b) == 2 and a[0] == b[0]:
            return a[0] + ' ' + a[1] + ' à ' + b[1]
    return ' à '.join(out)


PARENT = {'Viséen': 'Carbonifère', 'Tournaisien': 'Carbonifère', 'Namurien': 'Carbonifère', 'Westphalien': 'Carbonifère',
          'Stéphanien': 'Carbonifère', 'Autunien': 'Permien', 'Saxonien': 'Permien', 'Buntsandstein': 'Trias',
          'Muschelkalk': 'Trias', 'Keuper': 'Trias', 'Lettenkohle': 'Trias', 'Lias': 'Jurassique', 'Dogger': 'Jurassique',
          'Malm': 'Jurassique'}


def label_of(fams):
    """Libellé « Grès, conglomérats et quartzites » d'après les familles triées par poids."""
    names = []
    for k, _w in fams:
        lab = FAM_BY_KEY[k][0]
        if lab and lab not in names:
            names.append(lab)
    names = names[:3]
    if not names:
        return ''
    s = names[0][0].upper() + names[0][1:]
    if len(names) == 2:
        s += ' et ' + names[1]
    elif len(names) == 3:
        s += ', ' + names[1] + ' et ' + names[2]
    return s


LOOSE = {'sable', 'graviers', 'argile', 'limons', 'alluvions', 'tourbe', 'detritique', 'colluvions'}
UNIT_CACHE = {}
SAMPLE = {}          # numéro de légende -> exemple d'unité d'origine (source, lith, âge), pour le contrôle
LEGEND = {}          # (classe, roche, âge) -> numéro
LEGEND_LIST = [None]
SOURCES = Counter()
SOURCE_INFO = {}


def legend_id(props):
    lith, age = props.get('lith') or '', props.get('age') or ''
    key = (lith, age)
    if key in UNIT_CACHE:
        return UNIT_CACHE[key]
    weights = defaultdict(float)
    first = {}
    for term, w in split_terms(lith):
        fam = family_of(term)
        if fam is None:
            UNKNOWN_TERMS[term.lower()] += 1
            continue
        TERM_FAMILY[(term.lower(), fam)] += 1
        weights[fam] += w
        first.setdefault(fam, len(first))
    if not weights and props.get('name'):  # certaines cartes n'ont que le nom de l'unité
        fam = family_of(props['name'])
        if fam:
            weights[fam] = 1.0
            first[fam] = 0
    tot = sum(weights.values())
    lid = 0
    if tot > 0 and 'eau' not in weights:
        frac = defaultdict(float)
        for k, w in weights.items():
            frac[FAM_BY_KEY[k][1]] += w / tot
        cls = decide(frac)
        fams = sorted(weights.items(), key=lambda kv: (-kv[1], first[kv[0]]))
        fams = [(k, w) for k, w in fams if w / tot >= 0.1 and FAM_BY_KEY[k][1] > 0]
        label, afr = label_of(fams), age_fr(age)
        # dépôts meubles récents (sables, graviers, argiles, limons de l'Holocène) : des alluvions, dont l'acidité
        # dépend du bassin versant -> sol intermédiaire
        if re.search(r'holocene|recent', age, re.I) and set(weights) <= LOOSE and 'alluvions' not in weights:
            cls, label = 2, 'Alluvions : ' + label[0].lower() + label[1:]
        entry = (cls, label, afr)
        if cls and entry[1]:
            lid = LEGEND.get(entry)
            if lid is None:
                lid = LEGEND[entry] = len(LEGEND_LIST)
                LEGEND_LIST.append(list(entry))
                SAMPLE[lid] = (str(props.get('source_id')), lith[:140], age)
    UNIT_CACHE[key] = lid
    return lid


# ---------------------------------------------------------------------------------------------------------
# Remplissage de polygones sur la grille nationale (règle pair-impair : les trous sont respectés)
def fill(grid, rings, val, sgrid=None, sval=0):
    X1, Y1, X2, Y2 = [], [], [], []
    for c, r in rings:
        if len(c) < 3:
            continue
        if c[0] != c[-1] or r[0] != r[-1]:
            c = np.append(c, c[0])
            r = np.append(r, r[0])
        X1.append(c[:-1]); Y1.append(r[:-1]); X2.append(c[1:]); Y2.append(r[1:])
    if not X1:
        return 0
    x1, y1, x2, y2 = (np.concatenate(a) for a in (X1, Y1, X2, Y2))
    lo = np.clip(np.ceil(np.minimum(y1, y2) - 0.5), 0, H).astype(np.int64)
    hi = np.clip(np.ceil(np.maximum(y1, y2) - 0.5), 0, H).astype(np.int64)
    cnt = hi - lo
    m = cnt > 0
    if not m.any():
        return 0
    x1, y1, x2, y2, lo, cnt = x1[m], y1[m], x2[m], y2[m], lo[m], cnt[m]
    idx = np.repeat(np.arange(len(cnt)), cnt)
    start = np.repeat(np.cumsum(cnt) - cnt, cnt)
    rows = lo[idx] + (np.arange(int(cnt.sum())) - start)
    yc = rows + 0.5
    xx = x1[idx] + (yc - y1[idx]) * (x2[idx] - x1[idx]) / (y2[idx] - y1[idx])
    o = np.lexsort((xx, rows))
    rows, xx = rows[o], xx[o]
    _, counts = np.unique(rows, return_counts=True)
    if (counts % 2).any():                 # anneau mal fermé : on ignore ce polygone
        return 0
    ra = rows[0::2]
    c0 = np.clip(np.ceil(xx[0::2] - 0.5), 0, W).astype(np.int64)
    c1 = np.clip(np.ceil(xx[1::2] - 0.5), 0, W).astype(np.int64)
    k = c1 > c0
    if not k.any():
        return 0
    ra, c0, c1 = ra[k], c0[k], c1[k]
    r0, r1, cmin, cmax = int(ra.min()), int(ra.max()) + 1, int(c0.min()), int(c1.max())
    D = np.zeros((r1 - r0, cmax - cmin + 1), np.int32)
    np.add.at(D, (ra - r0, c0 - cmin), 1)
    np.add.at(D, (ra - r0, c1 - cmin), -1)
    cov = np.cumsum(D, axis=1)[:, :cmax - cmin] > 0
    grid[r0:r1, cmin:cmax][cov] = val
    if sgrid is not None:
        sgrid[r0:r1, cmin:cmax][cov] = sval
    return int(cov.sum())


def tile_range(z):
    n = 2 ** z
    tx = lambda lon: int((lon + 180) / 360 * n)
    ty = lambda lat: int((1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n)
    return [(z, x, y) for x in range(tx(BBOX[0]), tx(BBOX[2]) + 1) for y in range(ty(BBOX[3]), ty(BBOX[1]) + 1)]


def fetch(t, from_dir):
    z, x, y = t
    if from_dir:
        p = os.path.join(from_dir, str(z), str(x), str(y) + '.mvt')
        return t, (open(p, 'rb').read() if os.path.exists(p) else b''), None
    url = URL.format(z=z, x=x, y=y)
    err = None
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                b = r.read()
            if b[:2] == b'\x1f\x8b':
                b = gzip.decompress(b)
            return t, b, None
        except urllib.error.HTTPError as e:
            if e.code in (204, 404):
                return t, b'', None
            err = 'HTTP %d' % e.code
        except Exception as e:  # réseau
            err = str(e)
        time.sleep(3 * (attempt + 1))
    return t, None, err


def to_grid(coords, z, tx, ty, ext):
    a = np.asarray(coords, dtype=np.float64)
    if a.ndim != 2 or len(a) < 3:
        return None
    n = 2.0 ** z
    X = (tx + a[:, 0] / ext) / n
    Y = (ty + a[:, 1] / ext) / n
    lon = X * 360.0 - 180.0
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Y))))
    return (lon - LON0) * N, (LAT1 - lat) * N


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('out')
    ap.add_argument('--zoom', type=int, default=10)
    ap.add_argument('--from-dir')
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--diag', help='dossier des images de contrôle (sources, classes)')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    grid = np.zeros((H, W), np.uint16)
    sgrid = np.zeros((H, W), np.uint8)
    sids = {}
    todo = tile_range(a.zoom)
    if a.limit:
        todo = todo[:a.limit]
    print('Tuiles Macrostrat à lire : %d (zoom %d)' % (len(todo), a.zoom), flush=True)
    t0 = time.time()
    done = empty = feats = cells = 0
    failed = []
    with ThreadPoolExecutor(max_workers=a.workers) as ex:
        for fut in as_completed([ex.submit(fetch, t, a.from_dir) for t in todo]):
            (z, tx, ty), data, err = fut.result()
            done += 1
            if data is None:
                failed.append(((z, tx, ty), err))
                continue
            if not data:
                empty += 1
                continue
            try:
                dec = mvt.decode(data, default_options={'y_coord_down': True})
            except Exception as e:
                failed.append(((z, tx, ty), 'décodage : %s' % e))
                continue
            lay = dec.get('units')
            if not lay:
                empty += 1
                continue
            ext = lay.get('extent', 4096)
            for f in lay['features']:
                props = f.get('properties') or {}
                sid = str(props.get('source_id'))
                SOURCES[sid] += 1
                si = SOURCE_INFO.setdefault(sid, {'t': (props.get('ref_title') or props.get('ref_name') or '')[:90], 'y': props.get('ref_year'), 'bb': [999, 999, -999, -999]})
                lon_c, lat_c = (tx + 0.5) / 2 ** z * 360 - 180, math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (ty + 0.5) / 2 ** z))))
                si['bb'] = [min(si['bb'][0], lon_c), min(si['bb'][1], lat_c), max(si['bb'][2], lon_c), max(si['bb'][3], lat_c)]
                lid = legend_id(props)
                if not lid:
                    continue
                g = f.get('geometry') or {}
                polys = [g['coordinates']] if g.get('type') == 'Polygon' else g.get('coordinates', []) if g.get('type') == 'MultiPolygon' else []
                rings = []
                for poly in polys:
                    for ring in poly:
                        rg = to_grid(ring, z, tx, ty, ext)
                        if rg is not None:
                            rings.append(rg)
                if rings:
                    feats += 1
                    cells += fill(grid, rings, lid, sgrid, sids.setdefault(sid, len(sids) + 1))
            if done % 200 == 0:
                print('  %d/%d tuiles, %d unités, %.0f s' % (done, len(todo), feats, time.time() - t0), flush=True)
    print('Lu : %d tuiles (%d vides, %d en échec), %d polygones, %.0f s' % (done, empty, len(failed), feats, time.time() - t0))
    for t, e in failed[:20]:
        print('  échec', t, e)
    if len(failed) > max(10, len(todo) // 20):
        print('Trop d\'échecs : rien n\'est écrit.')
        sys.exit(1)

    # tuiles de 1°
    tiles, h = [], hashlib.sha1()
    for la in range(LAT0, LAT1):
        for lo in range(LON0, LON1):
            r0, c0 = (LAT1 - la - 1) * N, (lo - LON0) * N
            sub = grid[r0:r0 + N, c0:c0 + N]
            if not sub.any():
                continue
            raw = sub.astype('<u2').tobytes()
            h.update(raw)
            with open(os.path.join(a.out, '%d_%d.bin.gz' % (la, lo)), 'wb') as fh:
                fh.write(gzip.compress(raw, 9, mtime=0))
            tiles.append([la, lo])
    h.update(json.dumps(LEGEND_LIST, ensure_ascii=False).encode())
    idx = {'v': h.hexdigest()[:8], 'n': N, 'src': SRC, 'tiles': tiles, 'legend': LEGEND_LIST}
    with open(os.path.join(a.out, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(idx, fh, ensure_ascii=False, separators=(',', ':'))
    size = sum(os.path.getsize(os.path.join(a.out, f)) for f in os.listdir(a.out))
    print('Écrit : %d tuiles de 1°, %d entrées de légende, %.1f Mo, version %s' % (len(tiles), len(LEGEND_LIST) - 1, size / 1e6, idx['v']))

    # contrôles
    known = grid > 0
    cls_of = np.array([0] + [e[0] for e in LEGEND_LIST[1:]], np.uint8)
    cl = cls_of[grid]
    tot = int(known.sum()) or 1
    print('\nRépartition des cases renseignées (%d) :' % tot)
    for c, nm in ((1, 'acide'), (2, 'intermédiaire'), (3, 'calcaire'), (4, 'argileux')):
        print('  %-14s %5.1f %%' % (nm, 100.0 * (cl == c).sum() / tot))
    print('\nSources Macrostrat (unités lues) :')
    for sid, n in SOURCES.most_common(15):
        si = SOURCE_INFO.get(sid, {})
        print('  %5s %6d  %s (%s)  lon %.1f..%.1f lat %.1f..%.1f' % ((sid, n, si.get('t'), si.get('y')) + tuple(si.get('bb', [0, 0, 0, 0]))))
    print('\nPoints de contrôle :')
    names = {0: 'inconnu', 1: 'acide', 2: 'intermédiaire', 3: 'calcaire', 4: 'argileux'}
    for lat, lon, nm, want in CHECKS:
        r, c = int((LAT1 - lat) * N), int((lon - LON0) * N)
        lid = int(grid[r, c]) if 0 <= r < H and 0 <= c < W else 0
        e = LEGEND_LIST[lid] if lid else None
        got = e[0] if e else 0
        print('  %s %-34s %-13s %s%s' % ('ok ' if got in want else '?? ', nm, names[got], e[1] if e else '—', (' (' + e[2] + ')') if e and e[2] else ''))
        if lid in SAMPLE:
            print('        source %s : %s | %s' % SAMPLE[lid])
    if a.diag:
        diag(a.diag, grid, sgrid, sids, cls_of)
    print('\nTermes les plus fréquents -> famille :')
    for (term, fam), n in TERM_FAMILY.most_common(70):
        print('  %5d  %-40s %s' % (n, term[:40], fam))
    print('\nTermes non reconnus :')
    for term, n in UNKNOWN_TERMS.most_common(60):
        print('  %5d  %s' % (n, term[:80]))
    print('\nLégende (extrait) :')
    for i, e in enumerate(LEGEND_LIST[1:80], 1):
        print('  %3d  %s  %s  %s' % (i, names[e[0]], e[1], e[2]))


def write_png(path, rgb):
    h, w, _ = rgb.shape
    raw = b''.join(b'\x00' + rgb[y].tobytes() for y in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    with open(path, 'wb') as fh:
        fh.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


SRC_COL = {'249': (205, 205, 205), '94': (240, 150, 40), '49': (60, 170, 80), '140': (150, 80, 200), '77': (230, 210, 40),
           '23': (40, 190, 220), '207': (220, 40, 40)}
CLS_COL = [(255, 255, 255), (179, 16, 61), (199, 125, 18), (44, 111, 176), (122, 106, 46)]


def diag(out, grid, sgrid, sids, cls_of):
    os.makedirs(out, exist_ok=True)
    pal = np.zeros((256, 3), np.uint8) + 255
    for sid, i in sids.items():
        pal[i] = SRC_COL.get(sid, (0, 0, 0))
    write_png(os.path.join(out, 'sources.png'), pal[sgrid[::2, ::2]])
    cpal = np.array(CLS_COL, np.uint8)
    write_png(os.path.join(out, 'classes.png'), cpal[cls_of[grid[::2, ::2]]])
    r0, r1, c0, c1 = (LAT1 - 50) * N, (LAT1 - 47.5) * N, (4.5 - LON0) * N, (8.5 - LON0) * N
    write_png(os.path.join(out, 'sources-nord-est.png'), pal[sgrid[int(r0):int(r1), int(c0):int(c1)]])
    write_png(os.path.join(out, 'classes-nord-est.png'), cpal[cls_of[grid[int(r0):int(r1), int(c0):int(c1)]]])
    print('\nImages de contrôle écrites dans', out, '— couleurs des sources :', {s: SRC_COL.get(s, (0, 0, 0)) for s in sids})


CHECKS = [
    (49.06, 7.50, 'Vosges du Nord (grès)', {1}),
    (48.66, 6.10, 'Forêt de Haye (calcaire)', {3}),
    (47.10, 4.05, 'Morvan (granite)', {1}),
    (48.95, 4.30, 'Champagne crayeuse', {3}),
    (45.05, 5.45, 'Vercors (calcaire)', {3}),
    (44.20, -0.80, 'Landes (sables)', {1}),
    (48.41, 2.63, 'Forêt de Fontainebleau', {1, 2, 3}),
    (47.55, 1.95, 'Sologne (sables et argiles)', {1, 2}),
    (48.20, -3.50, 'Bretagne intérieure', {1}),
    (45.75, 1.70, 'Limousin (granite)', {1}),
    (46.60, 5.20, 'Bresse', {2, 4}),
    (46.70, 6.10, 'Jura (calcaire)', {3}),
    (44.25, 3.30, 'Grands Causses', {3}),
    (45.55, 2.85, 'Monts Dore (volcans)', {2}),
    (49.90, 4.70, 'Ardennes (schistes)', {1}),
    (48.30, 7.20, 'Vosges cristallines', {1}),
    (48.40, 7.70, 'Plaine d\'Alsace', {2}),
    (43.32, 5.75, 'Sainte-Baume (calcaire)', {3}),
    (42.10, 9.05, 'Corse (granite)', {1}),
    (49.60, 1.20, 'Pays de Caux (craie)', {3, 4}),
    (47.25, -1.50, 'Pays nantais', {1}),
    (49.13, 6.72, 'Forêt de Saint-Avold (grès)', {1}),
    (49.16, 6.80, 'Warndt (grès)', {1}),
    (48.55, 7.10, 'Forêt de Phalsbourg-Dabo (grès)', {1}),
    (43.95, 6.20, 'Préalpes de Digne', {3, 4}),
    (47.00, 0.60, 'Touraine (tuffeau)', {3, 1, 2}),
    (48.80, 6.20, 'Plateau lorrain', {3, 4}),
]

if __name__ == '__main__':
    main()
