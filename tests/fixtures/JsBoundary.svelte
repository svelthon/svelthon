<script module>
    // Le côté JavaScript de la frontière, tel que SvelteKit l'exerce : une
    // fonction qui rappelle son argument avec plus d'arguments qu'une signature
    // Python n'en déclare, et une autre qui sérialise ce qu'on lui passe.
    function twice(handler) {
        return handler(1, 'de trop') + handler(2, 'de trop');
    }

    function serialise(value) {
        return JSON.stringify(value);
    }

    function reste(handler) {
        return handler('a', 'b', 'c');
    }
</script>

<script lang="python">
def double(n):
    return n * 10


def joint(*morceaux):
    return "-".join(morceaux)


total = twice(double)
charge = serialise({"a": [1, 2], "b": None})
etoile = reste(joint)
</script>

<p data-k="total">{total}</p>
<p data-k="charge">{charge}</p>
<p data-k="etoile">{etoile}</p>
<p data-k="identite">{"oui" if twice is twice else "non"}</p>
<p data-k="to_python">{"oui" if to_python else "non"}</p>
