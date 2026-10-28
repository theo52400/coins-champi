#!/usr/bin/env bash
# Test de l'appli dans l'émulateur Android (lancé par .github/workflows/android.yml) : installe l'appli de test,
# la pilote par le débogage de la WebView, et vérifie le suivi de position écran éteint.
set -x
export PATH="$ANDROID_HOME/platform-tools:$PATH"
OUT=/tmp/android-test; mkdir -p "$OUT"
PKG=io.github.theo52400.coinsachampi
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put secure location_mode 3
adb install -r -g apk/app-debug.apk || exit 1
adb emu geo fix 7.5200 49.0400
adb logcat -c
cd /tmp/emu && node emulateur.mjs "$OUT"
adb logcat -d -v time > "$OUT/logcat-complet.txt"
grep -iE "Capacitor|chromium|Geolocation|coinsachampi|AndroidRuntime|FATAL" "$OUT/logcat-complet.txt" | tail -400 > "$OUT/logcat.txt"
exit 0
