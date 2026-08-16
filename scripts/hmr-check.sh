#!/usr/bin/env bash
# Le code généré d'un composant vit dans un module virtuel, entrée distincte du
# graphe Vite. Rien ne le relie au .svelte qui l'a produit : sans invalidation
# explicite, éditer le Python re-transforme le composant mais continue de servir
# l'ancien corps généré. Régression invisible à l'œil — d'où ce contrôle.
set -uo pipefail

PORT=${PORT:-5197}
V="http://localhost:$PORT"
ID="$V/@id/__x00__virtual:svelthon/src_Counter_svelte"
FILE="src/Counter.svelte"
BACKUP=$(mktemp)

cleanup() {
    cp "$BACKUP" "$FILE"
    rm -f "$BACKUP"
    pkill -f "vite --port $PORT" 2>/dev/null
}
trap cleanup EXIT

cp "$FILE" "$BACKUP"
pkill -f "vite --port $PORT" 2>/dev/null
(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 30); do
    sleep 0.5
    curl -sf -o /dev/null "$V/" && break
done

read_count() { curl -s "$ID" | grep -o '\.count = [0-9]*' | head -1 | grep -o '[0-9]*'; }

curl -s "$V/$FILE" >/dev/null
BEFORE=$(read_count)

sed -i 's/^count = 0$/count = 7/' "$FILE"
sleep 2
curl -s "$V/$FILE" >/dev/null
sleep 1
AFTER=$(read_count)

if [ "$BEFORE" = "0" ] && [ "$AFTER" = "7" ]; then
    echo "✓ HMR — le module virtuel suit l'édition du Python ($BEFORE → $AFTER)"
else
    echo "✗ HMR — attendu 0 → 7, obtenu ${BEFORE:-<vide>} → ${AFTER:-<vide>}"
    exit 1
fi
