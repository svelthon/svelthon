#!/usr/bin/env bash
# The SvelteKit application of `tests/kit-app`, built with adapter-node and
# served as production serves it. Nothing else here runs a SvelteKit build: the
# suite imports `src/lib` under jsdom, and the browser check builds a plain Vite
# application. What only SvelteKit's build does was invisible: a production
# server that answered 500 because a bundler ordered the engine after `boot.js`,
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
    pkill -f "node build/index.js" -P $$ 2>/dev/null
    [ -n "${SERVER:-}" ] && kill "$SERVER" 2>/dev/null
    rm -f "$LOG"
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
route /remote 'asking the server'
# A module named `remote.py`, which SvelteKit takes for one by its name.
route /named 'asking remote.py'

remote greeting 'hello from Python'
remote shout 'shouted from python'

exit $status
