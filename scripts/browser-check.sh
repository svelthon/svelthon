#!/usr/bin/env bash
# Ce que jsdom ne peut pas couvrir : l'emballage DOM de Brython. `from browser
# import html` s'y bloque alors qu'il fonctionne en navigateur, donc cette
# vérification tourne dans un Chromium headless.
set -uo pipefail

PORT=${PORT:-5199}
URL="http://localhost:$PORT/probe.html"
EXPECTED='import_html=OK imported | doc=OK DOMNode | create=OK INPUT | tagName=OK INPUT'

cleanup() { pkill -f "vite --port $PORT" 2>/dev/null; }
trap cleanup EXIT

cleanup
(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 30); do
    sleep 0.5
    curl -sf -o /dev/null "$URL" && break
done

REPORT=$(chromium --headless --no-sandbox --disable-gpu \
    --virtual-time-budget=8000 --dump-dom "$URL" 2>/dev/null |
    grep -o '<pre id="report">[^<]*' | sed 's|<pre id="report">||')

if [ "$REPORT" = "$EXPECTED" ]; then
    echo "✓ interop DOM en navigateur — $REPORT"
else
    echo "✗ interop DOM"
    echo "  attendu : $EXPECTED"
    echo "  obtenu  : ${REPORT:-<vide>}"
    exit 1
fi
