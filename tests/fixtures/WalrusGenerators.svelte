<script lang="python">
# A generator in its own parentheses whose element is a walrus: the `for` is
# the generator's clause, and the walrus assigns each element.
sink: object
</script>

<button data-k="plain" onclick={lambda: sink(list((value := n for n in [1, 2])))}>plain</button>
<button data-k="filtered" onclick={lambda: sink(list((value := n for n in [1, 2, 3] if n % 2)))}>filtered</button>
<button data-k="pairs" onclick={lambda: sink(list((value := (n, n + 10) for n in [1, 2])))}>pairs</button>
