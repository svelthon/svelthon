<script lang="python">
# A context key is equal as a dict key is: another literal, an equal number
# of another type or an equal tuple finds the entry, and a NaN finds only
# its own.
nan = float("nan")
set_context(0.5, "half")
set_context(1, "one")
set_context((1, "a"), "pair")
set_context(nan, "own nan")

found = [
    get_context(0.5),
    get_context(1.0),
    get_context(True),
    get_context((1, "a")),
    get_context(nan),
    get_context(float("nan")),
]
</script>

<p data-k="found">{found}</p>
