#!/usr/bin/env bash
# Brython's DOM wrapping, checked where it is real. `browser.html` is registered
# by brython.js itself, but only by the browser half it installs when it does not
# think it is running under Node — so what this asserts is that a browser needs
# no import at all, which is also what Bryntime arranges for jsdom.
set -uo pipefail

PORT=${PORT:-5199}
URL="http://localhost:$PORT/probe.html"
EXPECTED='preloaded=OK True | doc=OK DOMNode | create=OK INPUT | tagName=OK INPUT | realm=OK GET|peps'

# And the markup pass, `svelthon/markup`, loaded as a page that compiles its own
# components loads it: under Node alone, the suite never saw it stop loading.
MARKUP_URL="http://localhost:$PORT/markup.html"
MARKUP_EXPECTED='markup=OK {__expr_0()} {__expr_1()} | 2 functions'

# And a player's settings bound to members of one Python object, set together:
# Chromium hands each change back by an event of its own, later, which jsdom
# does not, so only here did the first event's write set the others back.
MEDIA_URL="http://localhost:$PORT/media.html"
MEDIA_EXPECTED='media=OK dict 0.125 1.125 true, instance 0.125 1.125 true | 0.125 1.125 muted 0.125 1.125 muted'

# And the window's two scroll coordinates bound to members of one dict: one
# axis written set the other back. Read in real time (`page_report`), since a
# `scroll` event is what the browser fires between frames, and the virtual time
# of `--dump-dom` renders none.
SCROLL_URL="http://localhost:$PORT/scroll.html"
SCROLL_EXPECTED='scroll=OK xy 130 240 (130 240) | yx 130 240 (130 240) | native 130 240 (130 240)'

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

# A command run beside a Chromium it drives over the protocol, which is gone
# once the command is done; its status is the command's.
with_cdp() {
    local profile=$1 pid code
    shift

    mkdir -p "$PROFILES"
    chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/$profile" \
        --remote-debugging-port=$CDP_PORT about:blank >/dev/null 2>&1 &
    pid=$!

    for _ in $(seq 40); do
        curl -sf -o /dev/null "http://127.0.0.1:$CDP_PORT/json" && break
        sleep 0.25
    done

    CDP_PORT=$CDP_PORT "$@"
    code=$?

    kill "$pid" 2>/dev/null
    wait "$pid" 2>/dev/null
    return $code
}

console_check() {
    local profile=$1
    shift

    with_cdp "cdp-$profile" node scripts/console-check.mjs "$@" || status=1
}

# What a page reports, read in real time over the same protocol
# (`scripts/page-report.mjs`).
live() {
    local attempt=$1 profile=$2 url=$3 id=$4

    with_cdp "report-$profile$attempt" node scripts/page-report.mjs "$url" "$id"
}

# The server this script started, `vite` then `vite preview` in turn, stopped by
# its pid: a pattern matched any process of the machine started the same way,
# another session's included. Waited for, so the port is free once it returns.
SERVER=
stop_server() {
    [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null && wait "$SERVER" 2>/dev/null
    SERVER=
}

cleanup() {
    stop_server
    rm -rf "$PROFILES"
}
trap cleanup EXIT

# Held, the port is held by another program, whose server every page below would
# be asked of once vite gives up in silence: empty pages, and a console as quiet
# as a green run's.
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
    echo "✗ port $PORT is held by another program: run with PORT set to a free one"
    exit 1
fi

node_modules/.bin/vite --port "$PORT" --strictPort >/dev/null 2>&1 &
SERVER=$!

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
# Every module of that graph is requested in turn, the engine among them, the
# big one, which Vite transforms before serving and which no cache holds on a
# first run: until it is warm, a render can overrun the browser's budget. The
# graph is walked from the imports Vite writes into what it serves, so the walk
# names no file of a package and follows one wherever Vite serves it from.
warm() {
    local queue=("$@") seen=" " path next

    while [ ${#queue[@]} -gt 0 ]; do
        path=${queue[0]}
        queue=("${queue[@]:1}")
        case "$seen" in *" $path "*) continue ;; esac
        seen+="$path "
        for next in $(curl -sf "http://localhost:$PORT$path" | grep -oE "(from|import) *[\"']/[^\"']+[\"']" | grep -oE "/[^\"']+"); do
            queue+=("$next")
        done
    done
}
warm /src/probe.js /src/markup-probe.js /src/media-probe.js /src/scroll-probe.js /demo/main.js

# What a page reports in its `<pre>`, asked again while it says nothing: on a
# loaded machine a first render can overrun its budget, as the demo's can
# (below), and the markup page, which compiles in the browser, came back empty
# once in two audits. A report that is there and wrong fails at once. Read from
# the DOM Chromium dumps (`dumped`), or as the page runs (`live`), each attempt
# with a profile of its own.
report() {
    local reader=$1 found attempt
    shift

    for attempt in 1 2 3; do
        found=$("$reader" "$attempt" "$@")
        [ -n "$found" ] && break
    done

    printf '%s' "$found"
}

dumped() {
    local attempt=$1 profile=$2 url=$3 id=$4

    browse "$profile$attempt" 8000 "$url" | grep -o "<pre id=\"$id\">[^<]*" | sed "s|<pre id=\"$id\">||"
}

REPORT=$(report dumped probe "$URL" report)

status=0

if [ "$REPORT" = "$EXPECTED" ]; then
    echo "✓ DOM interop in a browser — $REPORT"
else
    echo "✗ DOM interop"
    echo "  expected: $EXPECTED"
    echo "  got     : ${REPORT:-<empty>}"
    status=1
fi

MARKUP=$(report dumped markup "$MARKUP_URL" markup)

if [ "$MARKUP" = "$MARKUP_EXPECTED" ]; then
    echo "✓ markup pass in a browser — $MARKUP"
else
    echo "✗ markup pass in a browser"
    echo "  expected: $MARKUP_EXPECTED"
    echo "  got     : ${MARKUP:-<empty>}"
    status=1
fi

MEDIA=$(report dumped media "$MEDIA_URL" media)

if [ "$MEDIA" = "$MEDIA_EXPECTED" ]; then
    echo "✓ player settings in a browser — $MEDIA"
else
    echo "✗ player settings in a browser"
    echo "  expected: $MEDIA_EXPECTED"
    echo "  got     : ${MEDIA:-<empty>}"
    status=1
fi

SCROLL=$(report live scroll "$SCROLL_URL" scroll)

if [ "$SCROLL" = "$SCROLL_EXPECTED" ]; then
    echo "✓ window scroll in a browser — $SCROLL"
else
    echo "✗ window scroll in a browser"
    echo "  expected: $SCROLL_EXPECTED"
    echo "  got     : ${SCROLL:-<empty>}"
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
console_check dev "$URL" "$MARKUP_URL" "$MEDIA_URL" "$SCROLL_URL" "http://localhost:$PORT/demo/"

# The same page, from a production build. Everything above runs against the dev
# server, which serves modules one by one; a build bundles them, minifies them
# and resolves them once, and none of that is exercised anywhere else.
#
# What it does not hold: the order a bundler gives a CommonJS module. That one
# appears in a SvelteKit build, and this is a plain Vite application, so moving
# the engine's import back to a neighbouring file leaves every marker below
# green. `scripts/kit-check.sh` builds a SvelteKit app and sees it answer 500,
# and `tests/boot-order.test.js` holds it as text in the suite.
stop_server

if npx vite build >/dev/null 2>&1; then
    node scripts/build-size.mjs dist || status=1

    node_modules/.bin/vite preview --port "$PORT" --strictPort >/dev/null 2>&1 &
    SERVER=$!

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
