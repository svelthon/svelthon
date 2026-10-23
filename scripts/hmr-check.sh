#!/usr/bin/env bash
# Generated code lives in a virtual module, a distinct entry of the Vite graph
# that nothing links back to the source file. Without explicit invalidation,
# editing the Python re-transforms the surface but keeps serving the old
# generated body. A regression invisible to the eye — hence this check, on both
# paths: the component (through the preprocessor) and the store (through load()).
set -uo pipefail

PORT=${PORT:-5197}
V="http://localhost:$PORT"
BACKUPS=$(mktemp -d)

cleanup() {
    cp "$BACKUPS/Counter.svelte" demo/Counter.svelte 2>/dev/null
    cp "$BACKUPS/counter_store.svelte.py" demo/counter_store.svelte.py 2>/dev/null
    rm -rf "$BACKUPS"
    pkill -f "vite --port $PORT" 2>/dev/null
}
trap cleanup EXIT

cp demo/Counter.svelte "$BACKUPS/Counter.svelte"
cp demo/counter_store.svelte.py "$BACKUPS/counter_store.svelte.py"

pkill -f "vite --port $PORT" 2>/dev/null
(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 30); do
    sleep 0.5
    curl -sf -o /dev/null "$V/demo/" && break
done

# Reads the value of `count` in the generated body, whichever virtual module: a
# component's, told apart by what it was compiled from, as the component names
# it, and a store's under its name.
generated() {
    local body
    body=$(curl -s "$V/$1" | grep -o "/@id/__x00__virtual:svelthon/$2[^\"']*" | head -1)
    curl -s "$V${body:-/@id/__x00__virtual:svelthon/$2}" | grep -o '\.count = [0-9]*' | head -1 | grep -o '[0-9]*'
}

status=0

check() {
    local label=$1 file=$2 virtual=$3 warm=$4
    curl -s "$V/$warm" >/dev/null
    local before after
    before=$(generated "$warm" "$virtual")

    sed -i 's/^count = 0$/count = 7/' "$file"
    sleep 2
    curl -s "$V/$warm" >/dev/null
    sleep 1
    after=$(generated "$warm" "$virtual")

    if [ "$before" = "0" ] && [ "$after" = "7" ]; then
        echo "✓ HMR $label — the virtual module follows the edit ($before → $after)"
    else
        echo "✗ HMR $label — expected 0 → 7, got ${before:-<empty>} → ${after:-<empty>}"
        status=1
    fi
}

check "component" demo/Counter.svelte demo_Counter_svelte demo/Counter.svelte

# The store is only served once it has entered the graph: pull the component
# that imports it first.
#
# `?import` is not decoration: it is the exact specifier the component's virtual
# module holds (`import "/demo/counter_store.svelte.py?import"`). Requesting the
# bare path is a different entry of the graph, and re-transforms nothing.
curl -s "$V/demo/StoreDemo.svelte" >/dev/null
check "store" demo/counter_store.svelte.py demo_counter_store_svelte_py "demo/counter_store.svelte.py?import"

exit $status
