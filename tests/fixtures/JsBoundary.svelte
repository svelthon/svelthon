<script module>
    // The JavaScript side of the boundary, the way SvelteKit exercises it: one
    // function that calls its argument back with more arguments than a Python
    // signature declares, and one that serialises whatever it is handed.
    function twice(handler) {
        return handler(1, 'too many') + handler(2, 'too many');
    }

    function serialise(value) {
        return JSON.stringify(value);
    }

    function spread(handler) {
        return handler('a', 'b', 'c');
    }
</script>

<script lang="python">
def double(n):
    return n * 10


def joined(*pieces):
    return "-".join(pieces)


total = twice(double)
payload = serialise({"a": [1, 2], "b": None})
starred = spread(joined)
</script>

<p data-k="total">{total}</p>
<p data-k="payload">{payload}</p>
<p data-k="starred">{starred}</p>
<p data-k="identity">{"yes" if twice is twice else "no"}</p>
<p data-k="to_python">{"yes" if to_python else "no"}</p>
