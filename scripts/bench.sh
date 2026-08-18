#!/usr/bin/env bash
# Même composant en Python et en JavaScript, mesuré dans un vrai navigateur.
# Le coût de dispatch d'un clic étant identique des deux côtés, l'écart entre les
# colonnes est imputable au handler. Sept tours alternés, minimum retenu.
set -uo pipefail

PORT=${PORT:-5184}
URL="http://localhost:$PORT/bench.html"

cleanup() { pkill -f "vite --port $PORT" 2>/dev/null; }
trap cleanup EXIT

cleanup
(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 40); do
    sleep 0.5
    curl -sf -o /dev/null "$URL" && break
done

# La première visite ne mesurerait que la compilation à la volée de Vite.
curl -sf -o /dev/null "$URL"
curl -sf -o /dev/null "http://localhost:$PORT/src/bench/bench.js"
chromium --headless --no-sandbox --disable-gpu --user-data-dir="$(mktemp -d)" --dump-dom "$URL" >/dev/null 2>&1

chromium --headless --no-sandbox --disable-gpu --user-data-dir="$(mktemp -d)" --dump-dom "$URL" 2>/dev/null |
    sed -n '/id="out"/,/<\/pre>/p' | sed 's|<pre id="out">||; s|</pre>||'
