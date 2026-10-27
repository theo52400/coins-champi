#!/usr/bin/env python3
# Sonde : comment lire la seule carte du BRGM (source 249) là où la couche « carto » de Macrostrat montre une carte voisine.
import json, sys, urllib.request, urllib.error
from collections import Counter
import mapbox_vector_tile as mvt
UA = {'User-Agent': 'CoinsAChampi/1.0 (+https://github.com/theo52400/coins-champi)'}
def get(u, n=600):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120) as r:
            b = r.read(); return r.status, r.headers.get('content-type'), b
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get('content-type'), e.read()[:n]
    except Exception as e:
        return None, None, str(e).encode()
def show_mvt(b):
    try:
        t = mvt.decode(b)
        return {k: (len(v['features']), Counter(str(f['properties'].get('source_id')) for f in v['features']).most_common(6)) for k, v in t.items()}
    except Exception as e:
        return 'pas un MVT : ' + repr(b[:200])
for u in ['https://tiles.macrostrat.org/openapi.json', 'https://tiles.macrostrat.org/']:
    s, ct, b = get(u)
    print('\n==', u, s, ct, len(b))
    if s == 200 and b[:1] == b'{':
        try:
            j = json.loads(b); print('chemins :', '\n  '.join([''] + sorted(j.get('paths', {}).keys())))
        except Exception as e: print(b[:1500])
    else: print(b[:1500])
z, x, y = 10, 530, 352
for u in ['https://tiles.macrostrat.org/carto/{z}/{x}/{y}.mvt', 'https://tiles.macrostrat.org/carto/{z}/{x}/{y}.mvt?source_id=249',
          'https://tiles.macrostrat.org/map/{z}/{x}/{y}.mvt?source_id=249', 'https://tiles.macrostrat.org/map/{z}/{x}/{y}?source_id=249',
          'https://tiles.macrostrat.org/maps/249/{z}/{x}/{y}.mvt', 'https://tiles.macrostrat.org/maps/249/{z}/{x}/{y}',
          'https://tiles.macrostrat.org/map/249/{z}/{x}/{y}.mvt', 'https://tiles.macrostrat.org/maps/{z}/{x}/{y}.mvt?source_id=249',
          'https://tiles.macrostrat.org/all-maps/{z}/{x}/{y}.mvt', 'https://tiles.macrostrat.org/maps/france_1m/{z}/{x}/{y}',
          'https://tiles.macrostrat.org/map-ingestion/249/{z}/{x}/{y}', 'https://tiles.macrostrat.org/sources/249/{z}/{x}/{y}.mvt']:
    u = u.format(z=z, x=x, y=y)
    s, ct, b = get(u)
    print('\n==', u, s, ct, len(b), show_mvt(b) if s == 200 else b[:300])
for u in ['https://macrostrat.org/api/v2/geologic_units/map?lat=48.8&lng=6.5&scale=medium',
          'https://macrostrat.org/api/v2/geologic_units/map?lat=48.8&lng=6.5',
          'https://macrostrat.org/api/v2/geologic_units/map?shape=POLYGON((6.4%2048.7,6.6%2048.7,6.6%2048.9,6.4%2048.9,6.4%2048.7))&scale=medium&format=geojson_bare',
          'https://macrostrat.org/api/v2/geologic_units/map?shape=POLYGON((6.4%2048.7,6.6%2048.7,6.6%2048.9,6.4%2048.9,6.4%2048.7))&source_id=249&format=geojson_bare',
          'https://macrostrat.org/api/v2/geologic_units/map?shape=POLYGON((6.4%2048.7,6.6%2048.7,6.6%2048.9,6.4%2048.9,6.4%2048.7))&source_id=249',
          'https://macrostrat.org/api/v2/geologic_units/map/legend?source_id=249',
          'https://macrostrat.org/api/v2/defs/sources?source_id=94', 'https://macrostrat.org/api/v2/defs/sources?source_id=249&format=geojson_bare']:
    s, ct, b = get(u)
    print('\n==', u, s, ct, len(b))
    try:
        j = json.loads(b)
        feats = j.get('features') if isinstance(j, dict) else None
        if feats is None and isinstance(j, dict) and 'success' in j: feats = j['success'].get('data')
        if isinstance(feats, list):
            print('  éléments :', len(feats), Counter(str((f.get('properties') or f).get('source_id')) for f in feats).most_common(8))
            for f in feats[:3]:
                p = f.get('properties') or f
                print('   ', {k: str(v)[:100] for k, v in p.items() if k in ('source_id', 'map_id', 'legend_id', 'lith', 'age', 'name', 'scale', 'priority', 'ref_title', 'area', 'features')}, 'géométrie' if f.get('geometry') else '')
        else: print(str(j)[:800])
    except Exception: print(b[:500])
