#!/usr/bin/env bash
# Ce que jsdom ne peut pas couvrir : l'emballage DOM de Brython. `from browser
# import html` s'y bloque alors qu'il fonctionne en navigateur, donc cette
# vérification tourne dans un Chromium headless.
set -uo pipefail

PORT=${PORT:-5199}
URL="http://localhost:$PORT/probe.html"
EXPECTED='import_html=OK imported | doc=OK DOMNode | create=OK INPUT | tagName=OK INPUT'

# Un profil par lancement : deux Chromium coup sur coup se disputent le verrou du
# profil par défaut, et le second rend une page incomplète — au hasard.
PROFILES=$(mktemp -d)
cleanup() {
    pkill -f "vite --port $PORT" 2>/dev/null
    rm -rf "$PROFILES"
}
trap cleanup EXIT

cleanup

# pkill rend la main avant que le port soit rendu. Sans cette attente, le vite
# suivant échoue en silence (--strictPort) et le script interroge l'ancien
# serveur, en train de s'éteindre — d'où des échecs qui changent à chaque fois.
for _ in $(seq 40); do
    ss -ltn 2>/dev/null | grep -q ":$PORT " || break
    sleep 0.25
done

(npx vite --port "$PORT" --strictPort >/dev/null 2>&1 &)

for _ in $(seq 40); do
    sleep 0.5
    curl -sf -o /dev/null "$URL" && break
done

# Répondre 200 ne veut pas dire prêt : la première requête déclenche la
# compilation du graphe, qui dépasse le budget de temps de Chromium sur une
# machine modeste. On préchauffe les deux pages avant de mesurer.
curl -sf -o /dev/null "$URL"
curl -sf -o /dev/null "http://localhost:$PORT/"
# La coquille HTML répond tout de suite ; c'est le module d'entrée qui déclenche
# la compilation du graphe, et c'est elle qu'il faut attendre.
curl -sf -o /dev/null "http://localhost:$PORT/src/probe.js"
curl -sf -o /dev/null "http://localhost:$PORT/src/main.js"
# Le gros morceau : 4,6 Mo que Vite doit transformer avant de les servir. Tant
# qu'il n'est pas en cache, un rendu peut dépasser le budget du navigateur.
curl -sf -o /dev/null "http://localhost:$PORT/vendor/brython.js"
curl -sf -o /dev/null "http://localhost:$PORT/src/App.svelte"

REPORT=$(chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/probe" \
    --virtual-time-budget=8000 --dump-dom "$URL" 2>/dev/null |
    grep -o '<pre id="report">[^<]*' | sed 's|<pre id="report">||')

status=0

if [ "$REPORT" = "$EXPECTED" ]; then
    echo "✓ interop DOM en navigateur — $REPORT"
else
    echo "✗ interop DOM"
    echo "  attendu : $EXPECTED"
    echo "  obtenu  : ${REPORT:-<vide>}"
    status=1
fi

# La démo entière, rendue pour de bon. Sur une machine modeste, un premier rendu
# peut manquer un morceau — le serveur de dev compile encore. On redemande donc
# la page tant qu'il manque quelque chose, dans une limite bornée : ce qui compte
# est que la page finisse complète, pas qu'elle le soit du premier coup.
expected=("increment()" "Hello Ada!" "0 · []" "1180591620717411303424" \
    "['apple', 'pear']" "pear · ▪" "let count = \$state(0)")

missing=()
for attempt in 1 2 3; do
    APP=$(chromium --headless --no-sandbox --disable-gpu --user-data-dir="$PROFILES/app$attempt" \
        --virtual-time-budget=40000 --dump-dom "http://localhost:$PORT/" 2>/dev/null)

    missing=()
    for one in "${expected[@]}"; do
        printf '%s' "$APP" | grep -qF -- "$one" || missing+=("$one")
    done

    [ ${#missing[@]} -eq 0 ] && break
done

for one in "${expected[@]}"; do
    if printf '%s' "$APP" | grep -qF -- "$one"; then
        echo "✓ démo — $one"
    else
        echo "✗ démo — introuvable : $one"
        status=1
    fi
done

exit $status
