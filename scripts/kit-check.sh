#!/usr/bin/env bash
# The SvelteKit application of `tests/kit-app`, built with adapter-node and
# served as production serves it. Nothing else here runs a SvelteKit build: the
# suite imports `src/lib` under jsdom, and the browser check builds a plain Vite
# application. What only SvelteKit's build does was invisible: a production
# server that answered 500 because a bundler ordered the engine after the module
# that starts it,
# and a `.remote.py` that SvelteKit refused at build for its default export.
#
# Every route answers 200 with what its Python wrote, and the remote function
# answers over HTTP as the browser calls it.
set -uo pipefail

PORT=${PORT:-5196}
ORIGIN="http://localhost:$PORT"
APP=tests/kit-app
LOG=$(mktemp)
status=0

cleanup() {
    [ -n "${SERVER:-}" ] && kill "$SERVER" 2>/dev/null
    [ -n "${DEV:-}" ] && kill "$DEV" 2>/dev/null
    rm -rf "$LOG" "$APP/src/routes/leak"
}
trap cleanup EXIT

# Built from nothing: a `.svelte-kit` left by an earlier build is part of the
# next one.
rm -rf "$APP/build" "$APP/.svelte-kit"

if ! (cd "$APP" && ORIGIN=$ORIGIN npx vite build --logLevel error) >"$LOG" 2>&1; then
    echo "✗ kit build — $(grep -m1 -E '^(Error|\[Error|SyntaxError|TypeError)' "$LOG" || tail -1 "$LOG")"
    exit 1
fi

echo "✓ kit build — adapter-node"

(cd "$APP" && PORT=$PORT exec node build/index.js) >"$LOG" 2>&1 &
SERVER=$!

for _ in $(seq 60); do
    curl -s -o /dev/null "$ORIGIN/" && break
    kill -0 "$SERVER" 2>/dev/null || break
    sleep 0.25
done

if ! kill -0 "$SERVER" 2>/dev/null; then
    echo "✗ kit server — $(grep -m1 -E 'Error' "$LOG" || tail -1 "$LOG")"
    exit 1
fi

# A route, and what its Python wrote into the page the server rendered.
route() {
    local path=$1 expected=$2 page code

    page=$(curl -s -w '\n%{http_code}' "$ORIGIN$path")
    code=${page##*$'\n'}

    if [ "$code" = 200 ] && printf %s "$page" | grep -qF "$expected"; then
        echo "✓ kit $path — $expected"
    else
        echo "✗ kit $path — $code, not found: $expected"
        status=1
    fi
}

# A route whose Python `load()` throws SvelteKit's `error()` or `redirect()`:
# the status the framework answers, and a redirect's location. Each reached it
# as another `Error`, and the page was a 500.
answered() {
    local path=$1 wanted=$2 location=${3:-} head code

    head=$(curl -s -o /dev/null -D - "$ORIGIN$path")
    code=$(printf %s "$head" | head -1 | cut -d' ' -f2)

    if [ "$code" = "$wanted" ] && { [ -z "$location" ] || printf %s "$head" | grep -qi "^location: $location"; }; then
        echo "✓ kit $path — $wanted${location:+ to $location}"
    else
        echo "✗ kit $path — $code, not $wanted${location:+ to $location}"
        status=1
    fi
}

# A header the server's `handle` in Python wrote on the answer. Hooks are found
# by the extensions `moduleExtensions` names, as a route module is, since
# SvelteKit 3: a `.py` of them needed a JavaScript file re-exporting it.
header() {
    local path=$1 wanted=$2

    if curl -s -o /dev/null -D - "$ORIGIN$path" | grep -qi "^$wanted"; then
        echo "✓ kit $path — $wanted"
    else
        echo "✗ kit $path — no $wanted"
        status=1
    fi
}

# A remote function, as the browser asks it: `GET /_app/remote/<id>`, its id
# the one SvelteKit wrote into the client.
remote() {
    local name=$1 expected=$2 id answer

    id=$(grep -rhoE "[A-Za-z0-9_-]+/$name\b" "$APP/build/client" | head -1)
    answer=$(curl -s "$ORIGIN/_app/remote/$id")

    if printf %s "$answer" | grep -qF '"type":"result"' && printf %s "$answer" | grep -qF "$expected"; then
        echo "✓ kit remote — $name() answered from Python"
    else
        echo "✗ kit remote — ${id:-no id for $name}: ${answer:0:200}"
        status=1
    fi
}

route / 'kit + python = -4'
route /load '42 from [0, 1, 4, 9]'
route /universal '42 at the universal route'
# A `load` bound by a call, which the page took for none.
route /bound 'load bound by a call'
# A layout and a page whose `load` comes by a star import.
route /starred 'starred layout and starred page'
route /remote 'asking the server'
# A module named `remote.py`, which SvelteKit takes for one by its name.
route /named 'asking remote.py'
# The compiler in the bundle, as a playground has it, and the engine started
# first all the same.
route /compiler 'compiled True'
answered /missing 404
answered /moved 303 /load
# The hooks in Python: the server's, the universal `reroute`, and the client's,
# built into the browser's bundle.
header / 'x-python-hook: handle'
route /rerouted '42 from [0, 1, 4, 9]'

if grep -rqF 'client hook from Python' "$APP/build/client"; then
    echo "✓ kit client hooks — built from Python"
else
    echo "✗ kit client hooks — not in the client's bundle"
    status=1
fi

remote greeting 'hello from Python'
remote shout 'shouted from python'
# Prerendered at build: SvelteKit rewrites the declaration of its name, and a
# variable of ours of that name stopped the build.
remote facts 'prerendered from Python'

# The same routes from the dev server, the one an application is written on,
# which checks what production does not: a `load()` whose answer is no plain
# object was a 500 there, every dict a Python `load()` returns among them.
ORIGIN="http://localhost:$((PORT + 1))"
(cd "$APP" && exec node ../../node_modules/vite/bin/vite.js dev --port "$((PORT + 1))" --strictPort) >"$LOG" 2>&1 &
DEV=$!

for _ in $(seq 120); do
    curl -s -o /dev/null "$ORIGIN/" && break
    kill -0 "$DEV" 2>/dev/null || break
    sleep 0.25
done

if kill -0 "$DEV" 2>/dev/null; then
    route / 'kit + python = -4'
    route /load '42 from [0, 1, 4, 9]'
    route /universal '42 at the universal route'
    route /bound 'load bound by a call'
    route /starred 'starred layout and starred page'
    answered /missing 404
    answered /moved 303 /load
    header / 'x-python-hook: handle'
    route /rerouted '42 from [0, 1, 4, 9]'
else
    echo "✗ kit dev server — $(grep -m1 -E 'Error' "$LOG" || tail -1 "$LOG")"
    status=1
fi

# A page whose Python imports a module of `src/lib/server/`: SvelteKit refuses
# to build it, as it refuses a JavaScript one, when its guard comes before
# Svelthon and sees what Python imports. After Svelthon it saw none of it, and
# the secret was in the client's bundle.
kill "$SERVER" "$DEV" 2>/dev/null
SERVER= DEV=
mkdir -p "$APP/src/routes/leak"
cp "$APP/leak/+page.svelte" "$APP/src/routes/leak/+page.svelte"

if (cd "$APP" && npx vite build --logLevel error) >"$LOG" 2>&1; then
    echo "✗ kit leak — a page importing a server module was built"
    status=1
elif grep -q "Cannot import" "$LOG"; then
    echo "✓ kit leak — a page importing a server module is refused"
else
    echo "✗ kit leak — refused for another reason: $(grep -m1 -E 'Error' "$LOG" || tail -1 "$LOG")"
    status=1
fi

exit $status
