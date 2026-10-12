#!/usr/bin/env bash
# Brython's DOM wrapping, checked where it is real. `browser.html` is registered
# by brython.js itself, but only by the browser half it installs when it does not
# think it is running under Node — so what this asserts is that a browser needs
# no import at all, which is also what globals.js arranges for jsdom.
set -uo pipefail

PORT=${PORT:-5199}
URL="http://localhost:$PORT/probe.html"
EXPECTED='preloaded=OK True | doc=OK DOMNode | create=OK INPUT | tagName=OK INPUT | realm=OK GET|peps'

# One profile per launch: two Chromiums back to back fight over the default
# profile's lock, and the second renders an incomplete page — at random.
PROFILES=$(mktemp -d)

browse() {
    local profile=$1 budget=$2 url=$3

    # The first `cleanup` runs before any of this and removes the directory, so
    # it is made again here rather than once at the top.
    mkdir -p "$PROFILES"

    chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/$profile" \
        --virtual-time-budget="$budget" --dump-dom "$url" 2>/dev/null
}

# Everything the browser itself says, which this check used to throw away: a
# Brython traceback, an unhandled rejection, a CSP violation or a Svelte runtime
# warning was invisible to it as long as the one string it greps was still in the
# page. A check that cannot see the failure it exists to catch is the shape three
# other checks here were fixed for.
#
# Over the DevTools protocol, which reports the level and the position. Chromium's
# own log carries the messages too, but writes every one of them as
# `INFO:CONSOLE` — a `console.error` and an uncaught throw alike — so the grep
# that reads it cannot tell an error from a log. See `scripts/console-check.mjs`.
CDP_PORT=${CDP_PORT:-9334}

console_check() {
    local profile=$1
    shift

    mkdir -p "$PROFILES"
    chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/cdp-$profile" \
        --remote-debugging-port=$CDP_PORT about:blank >/dev/null 2>&1 &
    local pid=$!

    for _ in $(seq 40); do
        curl -sf -o /dev/null "http://127.0.0.1:$CDP_PORT/json" && break
        sleep 0.25
    done

    CDP_PORT=$CDP_PORT node scripts/console-check.mjs "$@" || status=1

    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
}
cleanup() {
    # Two servers use this port in turn, `vite` then `vite preview`, and the
    # second does not match the first's pattern.
    pkill -f "vite --port $PORT" 2>/dev/null
    pkill -f "vite preview --port $PORT" 2>/dev/null
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
curl -sf -o /dev/null "http://localhost:$PORT/demo/"
# The HTML shell answers at once; it is the entry module that triggers the
# graph's compilation, and that is what has to be waited for.
curl -sf -o /dev/null "http://localhost:$PORT/src/probe.js"
curl -sf -o /dev/null "http://localhost:$PORT/demo/main.js"
# The big one: the engine, which Vite transforms before serving and which no
# cache holds on a first run. Until it is warm, a render can overrun the
# browser's budget. `boot.js` names this file, so a page asks for this one.
curl -sf -o /dev/null "http://localhost:$PORT/vendor/brython_runtime.js"
curl -sf -o /dev/null "http://localhost:$PORT/demo/App.svelte"

REPORT=$(browse probe 8000 "$URL" |
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
    APP=$(browse "app$attempt" 40000 "http://localhost:$PORT/demo/")

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

# Both dev pages, and what they said while the assertions above read the DOM.
console_check dev "$URL" "http://localhost:$PORT/demo/"

# The same page, from a production build. Everything above runs against the dev
# server, which serves modules one by one; a build bundles them, minifies them
# and resolves them once, and none of that is exercised anywhere else.
#
# What it does not hold: the order a bundler gives a CommonJS module. That one
# appears in a SvelteKit build, and this is a plain Vite application, so moving
# the engine's import back to a neighbouring file leaves every marker below
# green. `tests/boot-order.test.js` holds it as text for want of a Kit app here.
pkill -f "vite --port $PORT" 2>/dev/null
for _ in $(seq 40); do
    ss -ltn 2>/dev/null | grep -q ":$PORT " || break
    sleep 0.25
done

if npx vite build >/dev/null 2>&1; then
    (npx vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &)

    for _ in $(seq 40); do
        sleep 0.5
        curl -sf -o /dev/null "http://localhost:$PORT/demo/" && break
    done

    BUILT=$(browse built 40000 "http://localhost:$PORT/demo/")

    built_missing=()
    for one in "${expected[@]}"; do
        grep -qF -- "$one" <<< "$BUILT" || built_missing+=("$one")
    done

    if [ ${#built_missing[@]} -eq 0 ]; then
        echo "✓ production build — ${#expected[@]} markers, $(printf %s "$BUILT" | wc -c) bytes of DOM"
    else
        echo "✗ production build — not found: ${built_missing[*]}"
        status=1
    fi

    console_check built "http://localhost:$PORT/demo/"
else
    echo "✗ production build — vite build failed"
    status=1
fi

exit $status
