#!/usr/bin/env bash
# Sonde n°2 : sources de lithologie accessibles pour la France
set -x
cap() { curl -sSL --max-time 120 "$1" | head -c "${2:-400000}"; }
# 1. Macrostrat : points en France, plusieurs échelles
for s in small medium large; do
  for p in "49.06,7.50" "48.66,6.10" "48.41,2.63" "44.30,-0.90"; do
    la=${p%,*}; lo=${p#*,}
    curl -sS --max-time 60 "https://macrostrat.org/api/v2/geologic_units/map?lat=$la&lng=$lo&scale=$s" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('success',{}).get('data',[]); print('$s $p', [(u.get('source_id'), u.get('name'), u.get('lith'), (u.get('descrip') or '')[:80]) for u in r][:3])" || true
  done
done
curl -sS --max-time 60 "https://macrostrat.org/api/v2/defs/sources?format=json" | python3 -c "import sys,json; d=json.load(sys.stdin)['success']['data']; print(len(d), 'sources'); [print(s.get('source_id'), s.get('name'), s.get('scale'), s.get('url')) for s in d if any(w in (s.get('name') or '') for w in ('France','Europe','French','IGME','OneGeology','BRGM'))]" || true
# 2. EGDI (EuroGeoSurveys)
cap "https://data.geus.dk/egdi/wms/?service=WMS&request=GetCapabilities" 3000000 | grep -oE "<Name>[^<]*</Name>" | grep -iE "1m|geol|lith|surface" | head -40
cap "https://data.geus.dk/egdi/wfs/?service=WFS&request=GetCapabilities" 3000000 | grep -oE "<(wfs:)?Name>[^<]*</(wfs:)?Name>" | head -60
# 3. BRGM : services WMS et WFS
cap "https://geoservices.brgm.fr/geologie?SERVICE=WMS&REQUEST=GetCapabilities" 3000000 | grep -oE "<Name>[^<]*</Name>" | head -60
cap "https://geoservices.brgm.fr/geologie?SERVICE=WFS&REQUEST=GetCapabilities" 20000 | head -c 3000; echo
cap "https://geoservices.brgm.fr/geologie?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities" 3000000 | grep -oE "<(wfs:)?Name>[^<]*</(wfs:)?Name>" | head -60
curl -sSIL --max-time 30 "https://infoterre.brgm.fr/" | head -5
curl -sSIL --max-time 30 "https://www.brgm.fr/" | head -5
# 4. Géoplateforme IGN : couches géologiques éventuelles
curl -sS --max-time 300 "https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetCapabilities" | grep -oE "<(wfs:)?Name>[^<]*</(wfs:)?Name>" | grep -iE "geol|litho|brgm|sol|pedo" | head -40
curl -sS --max-time 300 "https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetCapabilities" | grep -oE "<Name>[^<]*</Name>" | grep -iE "geol|litho|brgm|sol|pedo" | head -40
# 5. data.gouv.fr : jeux « lithologie » / « géologique 1/1 000 000 »
for q in "lithologie" "carte geologique millionieme" "geologie 1 000 000" "BDGSF" "base de donnees geographique des sols"; do
  curl -sS --max-time 60 "https://www.data.gouv.fr/api/1/datasets/?q=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$q")&page_size=8" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for ds in d.get('data', []):
    print('##', ds.get('title'), '|', ds.get('organization', {}) and ds['organization'].get('name'))
    for r in ds.get('resources', [])[:6]: print('   -', r.get('format'), r.get('filesize'), r.get('url'))
" || true
done
# 6. pH des sols de l'ESDAC / JRC (accès direct ?)
curl -sSIL --max-time 30 "https://esdac.jrc.ec.europa.eu/content/topsoil-physical-properties-europe-based-lucas-topsoil-data" | head -5
