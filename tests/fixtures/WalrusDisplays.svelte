<script lang="python">
# A list or a set whose elements a walrus stands in bare, in a handler: each
# assigns the component's name, as Python's grammar lets it stand there.
sink: object
value = 0
other = 0
xs = [1, 2, 3]
</script>

<button data-k="list" onclick={lambda: sink([value := n * 10 for n in xs])}>list</button>
<button data-k="set" onclick={lambda: sink(sorted({other := n for n in xs}))}>set</button>
<button data-k="display" onclick={lambda: sink([value := 5, other := 6])}>display</button>
<output>{value}:{other}</output>
