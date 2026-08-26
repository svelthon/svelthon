#!/usr/bin/env bash
# The same component in Python and in JavaScript, measured in a real browser.
# The dispatch cost of a click being identical on both sides, the gap between the
# columns is the handler's. Seven alternating rounds, the minimum is kept.
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

# The first visit would measure nothing but Vite's on-the-fly compilation.
curl -sf -o /dev/null "$URL"
curl -sf -o /dev/null "http://localhost:$PORT/src/bench/bench.js"
chromium --headless --no-sandbox --disable-gpu --user-data-dir="$(mktemp -d)" --dump-dom "$URL" >/dev/null 2>&1

chromium --headless --no-sandbox --disable-gpu --user-data-dir="$(mktemp -d)" --dump-dom "$URL" 2>/dev/null |
    sed -n '/id="out"/,/<\/pre>/p' | sed 's|<pre id="out">||; s|</pre>||'
