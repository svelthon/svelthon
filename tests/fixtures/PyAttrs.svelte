<script lang="python">
# Le pendant Python, mot pour mot, de tests/fixtures/JsAttrs.svelte.
attrs = {"data-n": "0"}
items = ["a"]


def mutate():
    attrs["data-n"] = "1"
    items.append("b")
</script>

<p data-k="spread" {...attrs}>étalé</p>
<p data-k="attr" title={",".join(items)}>attribut calculé</p>
<p data-k="raw" title={items}>attribut brut</p>
<p data-k="witness">{len(items)}</p>

<button data-k="mutate" onclick={mutate}>go</button>
