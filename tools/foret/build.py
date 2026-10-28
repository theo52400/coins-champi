#!/usr/bin/env python3
"""Carte des forêts de France pour la vue de loin (zooms 5 à 12).

1. Télécharge la BD Forêt V2 (IGN) de chaque département et la rastérise à 50 m en Lambert 93 (un octet par case :
   numéro de peuplement 1..21 selon js/core.js, 0 hors forêt).
2. Repère les cases boisées à moins de 100 m d'un milieu ouvert (lisières).
3. Résume en cases de 1/400° (≈ 280 m × 190 m), par carreaux de 1° : peuplement dominant + part de lisière
   (octet = peuplement | lisière << 5, lisière 0..3). Fichiers data/foret/{lat}_{lon}.geo (gzip).
4. Calcule une carte de France au 1/20° (≈ 5,5 km) : part boisée, peuplement dominant et, pour chaque espèce,
   part des cases « bonnes » (potentiel ≥ seuil, même formule que la carte de l'appli, sol d'après data/geol).
   Fichier data/foret/france.geo (gzip, couches à la suite), décrit dans data/foret/index.json.

Usage : python3 build.py <dossier de sortie> [--diag <dossier>] [--only D057,D067] [--keep-raster fichier.tif]
Besoins : gdal-bin, python3-gdal, python3-numpy, python3-scipy, 7z, node (pour lire js/core.js).
"""
import gzip, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time, urllib.request
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UA = 'CoinsAChampi/1.0 (https://github.com/theo52400/coins-champi)'
RES = 'https://data.geopf.fr/telechargement/resource/BDFORET'
# Raster national en Lambert 93
X0, X1, Y0, Y1, PIX = 75000.0, 1275000.0, 6025000.0, 7125000.0, 50.0
W, H = int((X1 - X0) / PIX), int((Y1 - Y0) / PIX)
FINE = 400          # cases par degré (carreaux fins)
SUB = 4             # échantillons par case et par axe
COARSE = 20         # cases par degré (carte de France)
LAT0, LAT1, LON0, LON1 = 41, 52, -6, 10
EDGE_SHARE = [0.0, 0.3, 0.6, 0.9]   # part de lisière représentée par les niveaux 0..3 (même table que js/map.js)


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def node(args, stdin=None):
    r = subprocess.run(['node', os.path.join(ROOT, 'tools/foret/params.mjs')] + args, input=stdin, capture_output=True, text=True, check=True, cwd=ROOT)
    return json.loads(r.stdout)


PARAMS = node(['params'])
NG = len(PARAMS['gkeys'])
OPEN = np.zeros(32, dtype=bool)
for i, f in enumerate(PARAMS['fam']):
    OPEN[i + 1] = (f == 'n')


# ---------- projection Lambert 93 (GRS80), vectorisée ----------
L93 = dict(n=0.7256077650532670, C=11754255.426096, Xs=700000.0, Ys=12655612.049876, e=0.0818191910428158, lon0=np.radians(3.0))


def lonlat_to_l93(lon, lat):
    p = L93
    phi = np.radians(lat)
    es = p['e'] * np.sin(phi)
    liso = np.log(np.tan(np.pi / 4 + phi / 2) * ((1 - es) / (1 + es)) ** (p['e'] / 2))
    R = p['C'] * np.exp(-p['n'] * liso)
    g = p['n'] * (np.radians(lon) - p['lon0'])
    return p['Xs'] + R * np.sin(g), p['Ys'] - R * np.cos(g)


# ---------- 1. téléchargement et rastérisation ----------
def http(url, timeout=120):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for k in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if k == 4:
                raise
            log('  nouvel essai', url, e)
            time.sleep(5 * (k + 1))


def list_departments():
    names = set()
    first = http(RES).decode('utf-8')
    m = re.search(r'pagecount="(\d+)"', first)
    pages = int(m.group(1)) if m else 1
    for p in range(1, pages + 1):
        xml = first if p == 1 else http(RES + '?page=%d' % p).decode('utf-8')
        names.update(re.findall(r'BDFORET_2-0__SHP_LAMB93_D[0-9AB]{3}_\d{4}-\d{2}-\d{2}', xml))
    best = {}
    for n in sorted(names):
        dep = re.search(r'_D([0-9AB]{3})_', n).group(1)
        if dep not in best or n > best[dep]:
            best[dep] = n
    return [best[d] for d in sorted(best)]


def rasterize_department(name, tif, work):
    xml = http(RES + '/' + name).decode('utf-8')
    urls = re.findall(r'https://[^"<]+\.7z(?:\.\d+)?', xml)
    if not urls:
        raise RuntimeError('pas d\'archive pour ' + name)
    d = tempfile.mkdtemp(dir=work)
    try:
        for u in sorted(set(urls)):
            with open(os.path.join(d, os.path.basename(u)), 'wb') as f:
                f.write(http(u, timeout=900))
        arch = sorted(f for f in os.listdir(d) if re.search(r'\.7z(\.001)?$', f))[0]
        subprocess.run(['7z', 'x', '-y', '-o' + d, os.path.join(d, arch)], check=True, capture_output=True)
        shps = [os.path.join(r, f) for r, _, fs in os.walk(d) for f in fs if f.upper() == 'FORMATION_VEGETALE.SHP']
        if not shps:
            raise RuntimeError('FORMATION_VEGETALE.shp absent de ' + name)
        shp = shps[0]
        from osgeo import ogr
        ds = ogr.Open(shp)
        lyr = ds.GetLayer(0)
        fields = [lyr.GetLayerDefn().GetFieldDefn(i).GetName() for i in range(lyr.GetLayerDefn().GetFieldCount())]
        fld = lambda *c: next((f for f in fields if f.upper() in c), None)
        fc, ft, fe = fld('CODE_TFV'), fld('TFV', 'LIB_TFV'), fld('ESSENCE')
        combos = {}
        for feat in lyr:
            key = (feat.GetField(fc) if fc else None, feat.GetField(ft) if ft else None, feat.GetField(fe) if fe else None)
            combos[key] = combos.get(key, 0) + 1
        lname = lyr.GetName()
        n_feat = lyr.GetFeatureCount()
        ds = None
        keys = list(combos)
        gids = node(['groups'], json.dumps([[k[0] or '', k[1] or '', k[2] or ''] for k in keys]))
        # numéro par code TFV (majoritaire si un même code donne plusieurs peuplements)
        by_code = {}
        for k, g in zip(keys, gids):
            by_code.setdefault(k[0] or '', {}).setdefault(g, 0)
            by_code[k[0] or ''][g] += combos[k]
        q = lambda s: "'" + str(s).replace("'", "''") + "'"
        cases = ' '.join('WHEN %s THEN %d' % (q(c), max(v, key=v.get)) for c, v in by_code.items() if c)
        default = max(by_code.get('', {0: 1}), key=by_code.get('', {0: 1}).get) if '' in by_code else 3
        sql = 'SELECT *, CASE "%s" %s ELSE %d END AS gid FROM "%s"' % (fc, cases, default, lname) if fc else 'SELECT *, %d AS gid FROM "%s"' % (default, lname)
        subprocess.run(['gdal_rasterize', '-q', '-a', 'gid', '-dialect', 'SQLite', '-sql', sql, shp, tif], check=True)
        return n_feat, len(by_code)
    finally:
        shutil.rmtree(d, ignore_errors=True)


def build_raster(tif, only, work):
    from osgeo import gdal, osr
    gdal.UseExceptions()
    drv = gdal.GetDriverByName('GTiff')
    ds = drv.Create(tif, W, H, 1, gdal.GDT_Byte, ['TILED=YES', 'SPARSE_OK=TRUE'])
    ds.SetGeoTransform([X0, PIX, 0, Y1, 0, -PIX])
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(2154)
    ds.SetProjection(srs.ExportToWkt())
    ds.GetRasterBand(1).Fill(0)
    ds = None
    deps = list_departments()
    if only:
        deps = [d for d in deps if any('_' + o + '_' in d for o in only)]
    log(len(deps), 'départements')
    done = []
    for i, name in enumerate(deps):
        t = time.time()
        nf, nc = rasterize_department(name, tif, work)
        done.append(name)
        log('  %2d/%d %s : %d polygones, %d codes, %.0f s' % (i + 1, len(deps), name, nf, nc, time.time() - t))
    return done


# ---------- 2. lisières ----------
def near_open(g):
    from scipy import ndimage
    yy, xx = np.mgrid[-2:3, -2:3]
    disk = (xx * xx + yy * yy) <= 4.5   # rayon 2 cases = 100 m
    out = np.zeros(g.shape, dtype=bool)
    step = 2000
    for r0 in range(0, g.shape[0], step):
        a, b = max(0, r0 - 2), min(g.shape[0], r0 + step + 2)
        blk = g[a:b]
        op = (blk == 0) | OPEN[blk]
        dil = ndimage.binary_dilation(op, structure=disk)
        out[r0:min(g.shape[0], r0 + step)] = (dil & ~op)[r0 - a:r0 - a + min(step, g.shape[0] - r0)]
    return out


# ---------- 3. carreaux fins ----------
def fine_tile(g, near, la, lo):
    S = FINE * SUB
    k = (np.arange(S) + 0.5) / S
    lon = lo + k
    lat = la + 1 - k
    LON, LAT = np.meshgrid(lon, lat)
    X, Y = lonlat_to_l93(LON, LAT)
    c = np.floor((X - X0) / PIX).astype(np.int64)
    r = np.floor((Y1 - Y) / PIX).astype(np.int64)
    ok = (c >= 0) & (c < W) & (r >= 0) & (r < H)
    c = np.where(ok, c, 0)
    r = np.where(ok, r, 0)
    gs = np.where(ok, g[r, c], 0).astype(np.uint8)
    ns = np.where(ok, near[r, c], False)
    if not gs.any():
        return None
    gs = gs.reshape(FINE, SUB, FINE, SUB).transpose(0, 2, 1, 3).reshape(FINE, FINE, SUB * SUB)
    ns = ns.reshape(FINE, SUB, FINE, SUB).transpose(0, 2, 1, 3).reshape(FINE, FINE, SUB * SUB)
    counts = np.zeros((FINE, FINE, 32), dtype=np.uint8)
    I, J = np.meshgrid(np.arange(FINE), np.arange(FINE), indexing='ij')
    for s in range(SUB * SUB):
        counts[I, J, gs[:, :, s]] += 1
    counts[:, :, 0] = 0
    grp = counts.argmax(axis=2).astype(np.uint8)
    covered = counts.sum(axis=2, dtype=np.int32)
    grp[covered < (SUB * SUB) // 4] = 0
    wooded = (gs > 0) & ~OPEN[gs]
    nw = wooded.sum(axis=2)
    share = np.where(nw > 0, (ns & wooded).sum(axis=2) / np.maximum(nw, 1), 0.0)
    lev = np.where(share < 0.15, 0, np.where(share < 0.45, 1, np.where(share < 0.75, 2, 3))).astype(np.uint8)
    lev[OPEN[grp]] = 3
    out = np.where(grp > 0, grp | (lev << 5), 0).astype(np.uint8)
    return out if out.any() else None


# ---------- sol (data/geol) ----------
class Geol:
    def __init__(self):
        p = os.path.join(ROOT, 'data/geol')
        j = json.load(open(os.path.join(p, 'index.json')))
        self.n = j.get('n', 200)
        self.cls = np.array([e[0] if e else 0 for e in j['legend']], dtype=np.uint8)
        self.p = p
        self.have = {(t[0], t[1]) for t in j['tiles']}

    def tile(self, la, lo):
        """Classe de sol (0..4) des cases fines du carreau, ou zéros."""
        if (la, lo) not in self.have:
            return np.zeros((FINE, FINE), dtype=np.uint8)
        raw = open(os.path.join(self.p, '%d_%d.geo' % (la, lo)), 'rb').read()
        if raw[:2] == b'\x1f\x8b':
            raw = gzip.decompress(raw)
        d = np.frombuffer(raw, dtype='<u2').reshape(self.n, self.n)
        c = self.cls[np.minimum(d, len(self.cls) - 1)]
        f = FINE // self.n
        return np.repeat(np.repeat(c, f, axis=0), f, axis=1)


def potentials(tile, soil):
    """Potentiel statique de chaque espèce (même formule que js/map.js, vue de loin)."""
    grp = tile & 31
    lev = tile >> 5
    share = np.array(EDGE_SHARE, dtype=np.float32)[lev]
    out = []
    for sp in PARAMS['species']:
        aff = np.array([0.0] + sp['aff'] + [0.0] * (31 - NG), dtype=np.float32)[grp]
        so = np.array(sp['soil'], dtype=np.float32)[soil]
        t, a, _ = sp['edge']
        if t == 'edge':
            ef = a + (1 - a) * share
        elif t == 'int':
            ef = 1 - a * share
        else:
            ef = np.ones_like(share)
        out.append(np.minimum(1.0, aff * so * ef) * (grp > 0))
    return out


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    out = args[0]
    diag = args[args.index('--diag') + 1] if '--diag' in args else None
    only = args[args.index('--only') + 1].split(',') if '--only' in args else None
    keep = args[args.index('--keep-raster') + 1] if '--keep-raster' in args else None
    work = tempfile.mkdtemp(prefix='foret-')
    tif = keep or os.path.join(work, 'france.tif')
    t0 = time.time()
    if keep and os.path.exists(keep):
        log('raster existant', keep)
        deps = []
    else:
        deps = build_raster(tif, only, work)
    from osgeo import gdal
    gdal.UseExceptions()
    src = gdal.Open(tif)          # garder une référence : sinon le jeu de données est libéré avant la lecture
    g = src.GetRasterBand(1).ReadAsArray()
    src = None
    log('raster lu', g.shape, 'cases boisées : %.1f %%' % (100.0 * ((g > 0) & ~OPEN[g]).mean()))
    near = near_open(g)
    log('lisières calculées')

    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith('.geo'):
            os.remove(os.path.join(out, f))
    geol = Geol()
    lv_good = PARAMS['levels'][1]
    nr, nc = (LAT1 - LAT0) * COARSE, (LON1 - LON0) * COARSE
    nsp = len(PARAMS['species'])
    co_forest = np.zeros((nr, nc), dtype=np.uint8)
    co_grp = np.zeros((nr, nc), dtype=np.uint8)
    co_sp = np.zeros((nsp, nr, nc), dtype=np.uint8)
    tiles = []
    h = hashlib.sha1()
    B = FINE // COARSE
    total = 0
    for la in range(LAT0, LAT1):
        for lo in range(LON0, LON1):
            t = fine_tile(g, near, la, lo)
            if t is None:
                continue
            blob = gzip.compress(t.tobytes(), 9, mtime=0)
            open(os.path.join(out, '%d_%d.geo' % (la, lo)), 'wb').write(blob)
            total += len(blob)
            h.update(blob)
            tiles.append([la, lo])
            # carte de France : blocs de B × B cases fines
            r0 = (LAT1 - 1 - la) * COARSE
            c0 = (lo - LON0) * COARSE
            grp = t & 31
            wooded = (grp > 0) & ~OPEN[grp]
            blk = lambda a: a.reshape(COARSE, B, COARSE, B).transpose(0, 2, 1, 3).reshape(COARSE, COARSE, B * B)
            co_forest[r0:r0 + COARSE, c0:c0 + COARSE] = np.round(255 * blk(wooded).mean(axis=2)).astype(np.uint8)
            gb = blk(grp)
            cnt = np.stack([(gb == k).sum(axis=2) for k in range(1, NG + 1)], axis=2)
            dom = cnt.argmax(axis=2) + 1
            co_grp[r0:r0 + COARSE, c0:c0 + COARSE] = np.where(cnt.max(axis=2) > 0, dom, 0)
            soil = geol.tile(la, lo)
            for s, p in enumerate(potentials(t, soil)):
                co_sp[s, r0:r0 + COARSE, c0:c0 + COARSE] = np.round(255 * blk(p >= lv_good).mean(axis=2)).astype(np.uint8)
    layers = ['forest', 'grp'] + [s['id'] for s in PARAMS['species']]
    coarse = np.concatenate([co_forest[None], co_grp[None], co_sp], axis=0)
    cblob = gzip.compress(coarse.tobytes(), 9, mtime=0)
    open(os.path.join(out, 'france.geo'), 'wb').write(cblob)
    h.update(cblob)
    idx = {'v': h.hexdigest()[:8], 'n': FINE, 'tiles': tiles, 'edge': EDGE_SHARE,
           'coarse': {'file': 'france.geo', 'n': COARSE, 'lat1': LAT1, 'lon0': LON0, 'rows': nr, 'cols': nc, 'layers': layers},
           'src': 'BD Forêt® V2 IGN, %d départements' % (len(deps) or -1)}
    json.dump(idx, open(os.path.join(out, 'index.json'), 'w'), separators=(',', ':'))
    log('%d carreaux, %.1f Mo + carte de France %.0f Ko, %.0f min' % (len(tiles), total / 1e6, len(cblob) / 1e3, (time.time() - t0) / 60))

    # points de contrôle
    def at(lat, lon):
        la, lo = int(np.floor(lat)), int(np.floor(lon))
        f = os.path.join(out, '%d_%d.geo' % (la, lo))
        if not os.path.exists(f):
            return 'pas de carreau'
        t = np.frombuffer(gzip.decompress(open(f, 'rb').read()), dtype=np.uint8).reshape(FINE, FINE)
        v = t[min(FINE - 1, int((la + 1 - lat) * FINE)), min(FINE - 1, int((lon - lo) * FINE))]
        return (PARAMS['gkeys'][(v & 31) - 1] if v & 31 else 'hors forêt') + ' lisière %d' % (v >> 5)
    for nm, la_, lo_ in [('Fontainebleau', 48.405, 2.66), ('Bitche (Vosges du Nord)', 49.03, 7.47), ('Landes (Solférino)', 44.13, -0.93),
                         ('Paris (Notre-Dame)', 48.853, 2.349), ('Forêt de Haye (Nancy)', 48.68, 6.10), ('Gérardmer', 48.06, 6.92),
                         ('Forêt de Tronçais', 46.66, 2.83), ('Camargue (Saintes-Maries)', 43.45, 4.43), ('Corse (Vizzavona)', 42.12, 9.13)]:
        log('contrôle %-26s %s' % (nm, at(la_, lo_)))
    if diag:
        write_diag(diag, coarse, layers, out)
    shutil.rmtree(work, ignore_errors=True)


def write_diag(diag, coarse, layers, out):
    from osgeo import gdal
    gdal.UseExceptions()
    os.makedirs(diag, exist_ok=True)
    cols = [(0, 0, 0)] + [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in PARAMS['colors']]

    def png(name, rgb):
        hh, ww, _ = rgb.shape
        mem = gdal.GetDriverByName('MEM').Create('', ww, hh, 3, gdal.GDT_Byte)
        for b in range(3):
            mem.GetRasterBand(b + 1).WriteArray(rgb[:, :, b])
        gdal.GetDriverByName('PNG').CreateCopy(os.path.join(diag, name), mem)

    def up(a, k):
        return np.repeat(np.repeat(a, k, axis=0), k, axis=1)
    grp = coarse[layers.index('grp')]
    lut = np.array(cols + [(0, 0, 0)] * (256 - len(cols)), dtype=np.uint8)
    rgb = lut[grp]
    rgb[grp == 0] = (245, 245, 240)
    png('france-peuplements.png', up(rgb, 3))
    for sp in ('cepe', 'girolle', 'trompette', 'morille'):
        v = coarse[layers.index(sp)].astype(np.float32) / 255
        v = np.clip(v * 3, 0, 1)
        rgb = np.stack([245 - 66 * v, 245 - 229 * v, 240 - 179 * v], axis=2).astype(np.uint8)
        png('france-%s.png' % sp, up(rgb, 3))
    f = os.path.join(out, '49_7.geo')
    if os.path.exists(f):
        t = np.frombuffer(gzip.decompress(open(f, 'rb').read()), dtype=np.uint8).reshape(FINE, FINE)
        rgb = lut[t & 31]
        rgb[(t & 31) == 0] = (245, 245, 240)
        edge = (t >> 5) >= 2
        rgb[edge & ((t & 31) > 0) & ~OPEN[t & 31]] = (200, 60, 60)
        png('carreau-49_7.png', rgb)


if __name__ == '__main__':
    main()
