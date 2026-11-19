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

PROFILE=$(mktemp -d)
READS=$(mktemp)
CDP_PORT=${CDP_PORT:-9335}

cleanup() {
    [ -n "${SERVER:-}" ] && kill "$SERVER" 2>/dev/null
    [ -n "${DEV:-}" ] && kill "$DEV" 2>/dev/null
    [ -n "${BROWSER:-}" ] && kill "$BROWSER" 2>/dev/null
    rm -rf "$LOG" "$READS" "$PROFILE" "$APP/src/routes/leak"
}
trap cleanup EXIT

# What Python hands the browser, read there as on the server, in a headless
# Chromium (`kit-data.mjs`): Svelte warns of no text a hydration changes.
data_check() {
    chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILE" \
        --remote-debugging-port="$CDP_PORT" about:blank >/dev/null 2>&1 &
    BROWSER=$!

    for _ in $(seq 40); do
        curl -sf -o /dev/null "http://127.0.0.1:$CDP_PORT/json" && break
        sleep 0.25
    done

    # Its own log: the dev server writes into `$LOG` as it runs.
    if CDP_PORT=$CDP_PORT node scripts/kit-data.mjs "$ORIGIN" >"$READS" 2>&1; then
        echo "✓ kit data — $(grep -c '^✓' "$READS") reads in the browser as on the server"
    else
        echo "✗ kit data — read otherwise in the browser:"
        grep -v '^✓' "$READS" | head -20
        status=1
    fi

    kill "$BROWSER" 2>/dev/null
    wait "$BROWSER" 2>/dev/null
    BROWSER=
}

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
# A JavaScript page re-exporting two modules that each have a `load`, two
# bindings of one function, which JavaScript leaves out: it was run.
route /ambiguous 'load: absent'
# A route re-exporting a module of page options, and the ambiguous one: no
# `load`, so none in the client's manifest, where a navigation asks the server
# for data (`~`); the relay posed for none had one asked at each navigation.
route /options 'options shared'
for one in /options /ambiguous; do
    if grep -qE "\"$one\": \[[0-9]" "$APP/.svelte-kit/generated/build/client-optimized/app.js"; then
        echo "✓ kit $one — no server load in the client's manifest"
    else
        echo "✗ kit $one — $(grep -oE "\"$one\": \[[^]]*" "$APP/.svelte-kit/generated/build/client-optimized/app.js" || echo 'not in the manifest')"
        status=1
    fi
done
# A `load` none at first and bound by a later request, read at each request:
# it stayed none.
route /late 'late: absent'
curl -s -o /dev/null "$ORIGIN/late/enable"
route /late 'late: enabled'
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
# An instance a remote function answers, read by a page the server renders as
# the browser reads it, rebuilt from what it reduces to: SvelteKit's alias of
# `$app` hid the import Svelthon relays, and the server read the raw one. The
# answer a JavaScript load returns was rebuilt again, its mark doubled. And one
# a factory of a module of its own made, whose import Svelthon did not relay.
# And one the load changes, read changed (`kit-data.mjs` reads it in the browser),
# and one whose reduction counts its runs, which checking it ran again. And a
# pair a load takes apart or makes of one (`/paired`, read by `kit-data.mjs`).
route /relayed 'data-k="relayed">RELAYED FROM PYTHON!|RELAYED FROM PYTHON!<'
route /relayed 'data-k="made">MADE BY A FACTORY!<'
route /relayed 'data-k="changed">CHANGED BY A LOAD / PUBLIC|CHANGED BY A LOAD / PUBLIC<'
route /relayed 'data-k="shelf">shelf:1<'
# Prerendered at build: SvelteKit rewrites the declaration of its name, and a
# variable of ours of that name stopped the build.
remote facts 'prerendered from Python'

# An instance of a class of `src/lib/server/`, refused on the server: the
# browser could not import it.
answered /vault 500
data_check

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
    # Vite's server copies the first module's names (its `exportAll`), as it
    # does with no plugin: the route runs the first one's `load`.
    route /ambiguous 'load: shared'
    route /late 'late: absent'
    curl -s -o /dev/null "$ORIGIN/late/enable"
    route /late 'late: enabled'
    answered /missing 404
    answered /moved 303 /load
    header / 'x-python-hook: handle'
    route /rerouted '42 from [0, 1, 4, 9]'
    route /relayed 'data-k="relayed">RELAYED FROM PYTHON!|RELAYED FROM PYTHON!<'
    route /relayed 'data-k="made">MADE BY A FACTORY!<'
    route /relayed 'data-k="changed">CHANGED BY A LOAD / PUBLIC|CHANGED BY A LOAD / PUBLIC<'
    route /relayed 'data-k="shelf">shelf:1<'
    answered /vault 500
    data_check
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
