#!/usr/bin/env bash
# Sonde : disponibilité et contenu des cartes géologiques harmonisées à 1/50 000 du BRGM (BD Charm-50)
set -x
for u in "https://infoterre.brgm.fr/telechargements/BDCharm50/GEO050K_HARM_057.zip" "http://infoterre.brgm.fr/telechargements/BDCharm50/GEO050K_HARM_057.zip"; do
  curl -sSIL --max-time 60 "$u" | grep -iE "^HTTP|content-length|content-type|location" | head -12
done
curl -sSL --max-time 900 -o /tmp/g57.zip "https://infoterre.brgm.fr/telechargements/BDCharm50/GEO050K_HARM_057.zip" || curl -sSL --max-time 900 -o /tmp/g57.zip "http://infoterre.brgm.fr/telechargements/BDCharm50/GEO050K_HARM_057.zip"
ls -la /tmp/g57.zip; file /tmp/g57.zip
unzip -l /tmp/g57.zip | head -60
mkdir -p /tmp/g57 && unzip -q -o /tmp/g57.zip -d /tmp/g57
find /tmp/g57 -iname "*.shp" | head -30
for f in $(find /tmp/g57 -iname "*S_FGEOL*.shp" | head -2); do
  ogrinfo -so -al "$f" | head -70
  ogrinfo -al -q "$f" -limit 25 | grep -vE "^\s+(MULTI)?POLYGON" | head -200
done
# Valeurs distinctes des champs de lithologie éventuels
for f in $(find /tmp/g57 -iname "*S_FGEOL*.shp" | head -1); do
  L=$(basename "$f" .shp)
  for fld in LITHO LITHOLOGIE LITHO_SIMP TYPE TYPE_GEOL AP_LOCALE; do
    ogrinfo -q -dialect SQLite -sql "SELECT \"$fld\" AS v, COUNT(*) AS n FROM \"$L\" GROUP BY 1 ORDER BY 2 DESC LIMIT 40" "$f" 2>&1 | grep -E "v \(|n \(" | paste - - | head -40
  done
done
# Services WFS du BRGM
curl -sS --max-time 60 "https://geoservices.brgm.fr/geologie?SERVICE=WFS&REQUEST=GetCapabilities" | grep -oE "<(wfs:)?Name>[^<]*</(wfs:)?Name>" | head -60
