#!/bin/sh
# scripts/e2e.sh — La app corre de punta a punta (condición 5 de la compuerta).
#
# Uso:  sh scripts/e2e.sh <sprint> [--android]
#       sh scripts/e2e.sh 01
#       sh scripts/e2e.sh 06 --android
#
# En orden, y se detiene en el primer paso que falla:
#   1. Typecheck (tsc --noEmit)
#   2. Los escenarios e2e de los sprints 01..N: tests 'specNN_eK ... e2e'.
#      Falla también si no corrió ninguno: Jest con -t sin coincidencias sale con 0.
#   3. El bundle de producción de iOS
#   4. Con --android: el APK release (assembleRelease)
set -e

SPRINT="$1"
ANDROID=0
if [ "$2" = "--android" ]; then
  ANDROID=1
elif [ -n "$2" ]; then
  echo "Opción desconocida: $2" >&2
  exit 2
fi

case "$SPRINT" in
  01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12) ;;
  *)
    echo "Uso: sh scripts/e2e.sh <01..12> [--android]" >&2
    exit 2
    ;;
esac

N="${SPRINT#0}"
if [ "$N" -le 9 ]; then
  PATRON="spec0[1-$N]_e[0-9]+ e2e"
else
  ULTIMO="$(expr "$N" - 10)"
  PATRON="spec(0[1-9]|1[0-$ULTIMO])_e[0-9]+ e2e"
fi
TMP="${TMPDIR:-/tmp}"
TMP="${TMP%/}"
RESULTADO="$TMP/crecemos-e2e-jest.json"

cd "$(dirname "$0")/.."

echo "== 1/4 · Typecheck"
npx tsc --noEmit

echo "== 2/4 · Escenarios e2e de los sprints 01 a $SPRINT"
rm -f "$RESULTADO"
npx jest --ci -t "$PATRON" --json --outputFile="$RESULTADO"
# Exige al menos un test pasado y ninguno fallido.
node -e '
  const r = require(process.argv[1]);
  console.log("   e2e pasados: " + r.numPassedTests + " · fallidos: " + r.numFailedTests);
  if (r.numFailedTests > 0 || r.numPassedTests < 1) {
    console.error("   No corrió ningún escenario e2e, o alguno falló.");
    process.exit(1);
  }
' "$RESULTADO"

echo "== 3/4 · Bundle de producción iOS"
npx react-native bundle --platform ios --dev false --entry-file index.js \
  --bundle-output "$TMP/crecemos.ios.jsbundle" \
  --assets-dest "$TMP/crecemos-assets"

if [ "$ANDROID" -eq 1 ]; then
  echo "== 4/4 · APK release de Android"
  (cd android && ./gradlew assembleRelease)
else
  echo "== 4/4 · APK de Android: omitido (usa --android)"
fi

echo "e2e del Sprint-$SPRINT: OK"
