#!/usr/bin/env bash
# Test de l'appli dans l'émulateur Android (lancé par .github/workflows/android.yml) : installe l'appli de test,
# la pilote par le débogage de la WebView, et vérifie le suivi de position écran éteint.
# Si Android redémarre pendant le test (ça arrive dans l'émulateur des machines de GitHub), on recommence une fois.
set -x
export PATH="$ANDROID_HOME/platform-tools:$PATH"
OUT=/tmp/android-test; mkdir -p "$OUT"
PKG=io.github.theo52400.coinsachampi
boot_ok() { for i in $(seq 1 60); do [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ] && return 0; sleep 5; done; return 1; }
adb wait-for-device; boot_ok
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0
adb shell settings put secure location_mode 3
for attempt in 1 2; do
  adb uninstall $PKG >/dev/null 2>&1
  adb install -r -g apk/app-debug.apk || exit 1
  adb emu geo fix 7.5200 49.0400
  adb logcat -c
  SS0=$(adb shell pidof system_server | tr -d '\r')
  (cd /tmp/emu && node emulateur.mjs "$OUT")
  adb logcat -d -v time > "$OUT/logcat-complet.txt"
  SS1=$(adb shell pidof system_server | tr -d '\r')
  [ -n "$SS0" ] && [ "$SS0" = "$SS1" ] && break
  echo "Essai $attempt : Android a redémarré pendant le test (system_server $SS0 -> $SS1)" | tee -a "$OUT/redemarrages.txt"
  adb wait-for-device; boot_ok; sleep 20
done
grep -iE "Capacitor|chromium|Geolocation|coinsachampi|AndroidRuntime|FATAL|system_server|Zygote" "$OUT/logcat-complet.txt" | tail -600 > "$OUT/logcat.txt"
exit 0
