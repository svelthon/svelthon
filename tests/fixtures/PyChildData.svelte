<script lang="python">
# What a Svelte parent hands, read as the dict and the list it holds.
data: dict
items: list
</script>

<p data-k="data">{len(data)} {data.get("a")} {data.get("z", 0)} {list(data.keys())} {list(data.items())}</p>
<p data-k="items">{items.count("b")} {items.index("b")} {items.index("b", 2)}</p>
