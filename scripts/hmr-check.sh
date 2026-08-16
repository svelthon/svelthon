#!/usr/bin/env bash
# Le code généré vit dans un module virtuel, entrée distincte du graphe Vite que
# rien ne relie au fichier source. Sans invalidation explicite, éditer le Python
# re-transforme la surface mais continue de servir l'ancien corps généré.
# Régression invisible à l'œil — d'où ce contrôle, sur les deux chemins :
# le composant (via le préprocesseur) et le store (via load()).
set -uo pipefail

PORT=${PORT:-5197}
V="http://localhost:$PORT"
BACKUPS=$(mktemp -d)

cleanup() {
    cp "$BACKUPS/Counter.svelte" src/Counter.svelte 2>/dev/null
    cp "$BACKUPS/counter_store.py" src/lib/counter_store.py 2>/dev/null
    rm -rf "$BACKUPS"
    pkill -f "vite --port $PORT" 2>/dev/null
}
trap cleanup EXIT

cp src/Counter.svelte "$BACKUPS/Counter.svelte"
cp src/lib/counter_store.py "$BACKUPS/counter_store.py"

pkill -f "vite --port $PORT" 2>/dev/null
(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 30); do
    sleep 0.5
    curl -sf -o /dev/null "$V/" && break
done

# Lit la valeur de `count` dans le corps généré, quel que soit le module virtuel.
generated() { curl -s "$V/@id/__x00__virtual:svelthon/$1" | grep -o '\.count = [0-9]*' | head -1 | grep -o '[0-9]*'; }

status=0

check() {
    local label=$1 file=$2 virtual=$3 warm=$4
    curl -s "$V/$warm" >/dev/null
    local before after
    before=$(generated "$virtual")

    sed -i 's/^count = 0$/count = 7/' "$file"
    sleep 2
    curl -s "$V/$warm" >/dev/null
    sleep 1
    after=$(generated "$virtual")

    if [ "$before" = "0" ] && [ "$after" = "7" ]; then
        echo "✓ HMR $label — le module virtuel suit l'édition ($before → $after)"
    else
        echo "✗ HMR $label — attendu 0 → 7, obtenu ${before:-<vide>} → ${after:-<vide>}"
        status=1
    fi
}

check "composant" src/Counter.svelte src_Counter_svelte src/Counter.svelte

# Le store n'est servi qu'une fois entré dans le graphe : on tire d'abord le
# composant qui l'importe.
curl -s "$V/src/StoreDemo.svelte" >/dev/null
check "store" src/lib/counter_store.py src_lib_counter_store_py src/lib/counter_store.py.svelte.js

exit $status
