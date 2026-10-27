#!/usr/bin/env bash
# Extrait de SoilGrids 2.0 (ISRIC, CC BY 4.0) le pH eau et le taux d'argile de surface (0-5 cm) sur la France,
# rééchantillonnés à 0,005° (≈ 500 m), puis découpés en tuiles de 1° pour l'appli (data/sol).
set -euo pipefail
cd "$(dirname "$0")/../.."
work=$(mktemp -d)
BBOX="-5.5 41.25 10.0 51.25"   # ouest sud est nord : France métropolitaine et Corse, avec les frontières
export GDAL_HTTP_MAX_RETRY=6 GDAL_HTTP_RETRY_DELAY=5 GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR CPL_VSIL_CURL_ALLOWED_EXTENSIONS=.vrt,.tif
for v in phh2o clay; do
  src="/vsicurl/https://files.isric.org/soilgrids/latest/data/$v/${v}_0-5cm_mean.vrt"
  echo "== $v : $src"
  gdalinfo "$src" | head -n 30
  time gdalwarp -overwrite -t_srs EPSG:4326 -te $BBOX -tr 0.005 0.005 -r average -ot Int16 -wo NUM_THREADS=ALL_CPUS -multi -co COMPRESS=DEFLATE "$src" "$work/$v.tif"
  gdalinfo -stats "$work/$v.tif" | grep -E "Size is|Minimum|NoData|Origin|Pixel Size" || true
done
rm -rf data/sol && mkdir -p data/sol
python3 tools/sol/tiles.py "$work/phh2o.tif" "$work/clay.tif" data/sol
du -sh data/sol
