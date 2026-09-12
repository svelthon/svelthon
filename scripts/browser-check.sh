#!/usr/bin/env bash
# Brython's DOM wrapping, checked where it is real. `browser.html` is registered
# by brython.js itself, but only by the browser half it installs when it does not
# think it is running under Node — so what this asserts is that a browser needs
# no import at all, which is also what globals.js arranges for jsdom.
set -uo pipefail

PORT=${PORT:-5199}
URL="http://localhost:$PORT/probe.html"
EXPECTED='preloaded=OK True | doc=OK DOMNode | create=OK INPUT | tagName=OK INPUT'

# One profile per launch: two Chromiums back to back fight over the default
# profile's lock, and the second renders an incomplete page — at random.
PROFILES=$(mktemp -d)
cleanup() {
    pkill -f "vite --port $PORT" 2>/dev/null
    rm -rf "$PROFILES"
}
trap cleanup EXIT

cleanup

# pkill returns before the port is released. Without this wait, the next vite
# fails silently (--strictPort) and the script queries the old server on its way
# out — hence failures that change every time.
for _ in $(seq 40); do
    ss -ltn 2>/dev/null | grep -q ":$PORT " || break
    sleep 0.25
done

(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 40); do
    sleep 0.5
    curl -sf -o /dev/null "$URL" && break
done

# Answering 200 does not mean ready: the first request triggers compilation of
# the graph, which overruns Chromium's time budget on a modest machine. Both
# pages are warmed up before measuring.
curl -sf -o /dev/null "$URL"
curl -sf -o /dev/null "http://localhost:$PORT/"
# The HTML shell answers at once; it is the entry module that triggers the
# graph's compilation, and that is what has to be waited for.
curl -sf -o /dev/null "http://localhost:$PORT/src/probe.js"
curl -sf -o /dev/null "http://localhost:$PORT/src/main.js"
# The big one: the engine, which Vite transforms before serving and which no
# cache holds on a first run. Until it is warm, a render can overrun the
# browser's budget. `boot.js` names this file, so a page asks for this one.
curl -sf -o /dev/null "http://localhost:$PORT/vendor/brython_runtime.js"
curl -sf -o /dev/null "http://localhost:$PORT/src/App.svelte"

REPORT=$(chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/probe" \
    --virtual-time-budget=8000 --dump-dom "$URL" 2>/dev/null |
    grep -o '<pre id="report">[^<]*' | sed 's|<pre id="report">||')

status=0

if [ "$REPORT" = "$EXPECTED" ]; then
    echo "✓ DOM interop in a browser — $REPORT"
else
    echo "✗ DOM interop"
    echo "  expected: $EXPECTED"
    echo "  got     : ${REPORT:-<empty>}"
    status=1
fi

# The whole demo, rendered for real. On a modest machine a first render can miss
# a piece — the dev server is still compiling. So the page is asked for again as
# long as something is missing, within a bounded limit: what matters is that the
# page ends up complete, not that it is complete on the first try.
expected=("increment()" "Hello Ada!" "0 · []" "1180591620717411303424" \
    "['apple', 'pear']" "pear · ▪" "let count = \$state(0)")

missing=()
for attempt in 1 2 3; do
    APP=$(chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/app$attempt" \
        --virtual-time-budget=40000 --dump-dom "http://localhost:$PORT/" 2>/dev/null)

    missing=()
    for one in "${expected[@]}"; do
        # A here-string rather than a pipe: `grep -q` exits on its first match,
        # `printf` is then killed by SIGPIPE, and `pipefail` reports the whole
        # pipeline as failed — so a marker found *early* in the page counted as
        # missing, at random, depending on how much was left to write.
        grep -qF -- "$one" <<< "$APP" || missing+=("$one")
    done

    [ ${#missing[@]} -eq 0 ] && break
done

for one in "${expected[@]}"; do
    if grep -qF -- "$one" <<< "$APP"; then
        echo "✓ demo — $one"
    else
        echo "✗ demo — not found: $one"
        status=1
    fi
done

exit $status
