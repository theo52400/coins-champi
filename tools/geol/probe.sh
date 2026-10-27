#!/usr/bin/env bash
# Sonde n°3 : accès en masse à la carte géologique de la France au 1/1 000 000 (BRGM) via Macrostrat (source 249)
set -x
for u in "https://macrostrat.org/api/v2/geologic_units/map?source_id=249&format=geojson_bare" \
         "https://macrostrat.org/api/v2/geologic_units/burwell?source_id=249&format=geojson_bare" \
         "https://macrostrat.org/api/v2/geologic_units/map?source_id=249"; do
  curl -sS --max-time 600 -o /tmp/x.json -w "%{http_code} %{size_download}\n" "$u"
  head -c 900 /tmp/x.json; echo; echo
done
curl -sS --max-time 60 "https://macrostrat.org/api/v2/defs/sources?source_id=249&format=json" | head -c 3000; echo
curl -sS --max-time 60 "https://macrostrat.org/api/v2/defs/sources?source_id=249&format=geojson_bare" | head -c 600; echo
pip install -q mapbox-vector-tile 2>&1 | tail -1
python3 - <<'PY'
import urllib.request, json
import mapbox_vector_tile
for z, x, y in [(8, 133, 87), (9, 266, 175), (10, 532, 350), (7, 66, 43)]:
    for layer in ['carto', 'carto-slim', 'burwell', 'all']:
        url = f'https://tiles.macrostrat.org/{layer}/{z}/{x}/{y}.mvt'
        try:
            b = urllib.request.urlopen(url, timeout=60).read()
            t = mapbox_vector_tile.decode(b)
            print(url, len(b), 'octets', {k: len(v['features']) for k, v in t.items()})
            for k, v in t.items():
                if v['features']: print('   clés', k, sorted(v['features'][0]['properties'].keys()))
                for f in v['features'][:4]: print('     ', k, {kk: (str(vv)[:90]) for kk, vv in f['properties'].items()})
        except Exception as e:
            print(url, 'ERREUR', e)
PY
