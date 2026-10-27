# Découpe les rasters pH (pH x 10) et argile (g/kg) en tuiles de 1° x 1° de 200 x 200 cellules.
# Chaque cellule tient sur 2 octets : pH x 10 (0 = inconnu), puis argile en %. Lignes du nord vers le sud.
import gzip, json, sys
import numpy as np
from osgeo import gdal

ph_ds, cl_ds, out = gdal.Open(sys.argv[1]), gdal.Open(sys.argv[2]), sys.argv[3]
x0, dx, _, y0, _, dy = ph_ds.GetGeoTransform()
ph = ph_ds.GetRasterBand(1).ReadAsArray().astype(np.int32)
cl = cl_ds.GetRasterBand(1).ReadAsArray().astype(np.int32)
ndp, ndc = ph_ds.GetRasterBand(1).GetNoDataValue(), cl_ds.GetRasterBand(1).GetNoDataValue()
valid = (ph > 0) & (cl >= 0)
if ndp is not None: valid &= ph != int(ndp)
if ndc is not None: valid &= cl != int(ndc)
B0 = np.where(valid, np.clip(ph, 30, 95), 0).astype(np.uint8)
B1 = np.where(valid, np.clip(np.rint(cl / 10.0), 0, 100), 0).astype(np.uint8)
N = int(round(1 / dx))
print('grille', B0.shape, 'pas', dx, dy, 'cellules par degré', N, 'valides', int(valid.sum()))

tiles = []
for lat in range(41, 52):
    for lon in range(-6, 11):
        r0 = int(round((y0 - (lat + 1)) / -dy)); c0 = int(round((lon - x0) / dx))
        rs, re_, cs, ce = max(r0, 0), min(r0 + N, B0.shape[0]), max(c0, 0), min(c0 + N, B0.shape[1])
        if rs >= re_ or cs >= ce: continue
        t = np.zeros((N, N, 2), np.uint8)
        t[rs - r0:re_ - r0, cs - c0:ce - c0, 0] = B0[rs:re_, cs:ce]
        t[rs - r0:re_ - r0, cs - c0:ce - c0, 1] = B1[rs:re_, cs:ce]
        if not t[:, :, 0].any(): continue
        with gzip.open(f'{out}/{lat}_{lon}.bin.gz', 'wb', 9) as f: f.write(t.tobytes())
        tiles.append([lat, lon])
json.dump({'v': 1, 'n': N, 'src': 'SoilGrids 2.0 (ISRIC, CC BY 4.0), pH eau et argile 0-5 cm', 'tiles': tiles}, open(f'{out}/index.json', 'w'), separators=(',', ':'))
print('tuiles', len(tiles))

# Contrôles sur des forêts connues (pH, argile %)
ref = {
    'Bitche, grès vosgien': (49.05, 7.43), 'Gorze, calcaires': (49.05, 6.00), 'Lindre, marnes': (48.81, 6.75),
    'Fontainebleau, sables': (48.40, 2.65), 'Landes, sables': (44.15, -0.74), 'Causse Méjean, calcaire': (44.25, 3.45),
    'Reims, craie': (49.15, 4.05), 'Morvan, granite': (47.19, 4.06), 'Jura, calcaire': (46.86, 6.07),
    'Sologne, sables argileux': (47.60, 2.02), 'Vosges, granite': (48.07, 6.88), 'Brocéliande, schistes': (48.02, -2.17)
}
for name, (la, lo) in ref.items():
    r, c = int((y0 - la) / -dy), int((lo - x0) / dx)
    print(f'{name:28s} pH {B0[r, c] / 10:4.1f}  argile {B1[r, c]:3d} %')
