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

for _ in $(seq 40); do
    sleep 0.5
    curl -sf -o /dev/null "$URL" && break
done

# Répondre 200 ne veut pas dire prêt : la première requête déclenche la
# compilation du graphe, qui dépasse le budget de temps de Chromium sur une
# machine modeste. On préchauffe les deux pages avant de mesurer.
curl -sf -o /dev/null "$URL"
curl -sf -o /dev/null "http://localhost:$PORT/"
# La coquille HTML répond tout de suite ; c'est le module d'entrée qui déclenche
# la compilation du graphe, et c'est elle qu'il faut attendre.
curl -sf -o /dev/null "http://localhost:$PORT/src/probe.js"
curl -sf -o /dev/null "http://localhost:$PORT/src/main.js"

REPORT=$(chromium --headless --no-sandbox --disable-gpu \
    --virtual-time-budget=8000 --dump-dom "$URL" 2>/dev/null |
    grep -o '<pre id="report">[^<]*' | sed 's|<pre id="report">||')

status=0

if [ "$REPORT" = "$EXPECTED" ]; then
    echo "✓ interop DOM en navigateur — $REPORT"
else
    echo "✗ interop DOM"
    echo "  attendu : $EXPECTED"
    echo "  obtenu  : ${REPORT:-<vide>}"
    status=1
fi

# La démo entière, rendue pour de bon : réactivité, prop à défaut Python, store
# partagé entre deux instances, et sémantique CPython.
APP=$(chromium --headless --no-sandbox --disable-gpu \
    --virtual-time-budget=15000 --dump-dom "http://localhost:$PORT/" 2>/dev/null)

# Les deux dernières lignes couvrent le gabarit : une compréhension rendue avec
# str() de Python, et un {#each} qui parcourt les paires d'un dict.
for expected in "increment()" "Hello Ada!" "0 · []" "1180591620717411303424" \
    "['apple', 'pear']" "pear · ▪" "let count = \$state(0)"; do
    if printf '%s' "$APP" | grep -qF -- "$expected"; then
        echo "✓ démo — $expected"
    else
        echo "✗ démo — introuvable : $expected"
        status=1
    fi
done

exit $status
