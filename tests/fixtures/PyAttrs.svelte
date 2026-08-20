<script lang="python">
# The Python counterpart, word for word, of tests/fixtures/JsAttrs.svelte.
attrs = {"data-n": "0"}
items = ["a"]


def mutate():
    attrs["data-n"] = "1"
    items.append("b")
</script>

<p data-k="spread" {...attrs}>spread</p>
<p data-k="attr" title={",".join(items)}>computed attribute</p>
<p data-k="raw" title={items}>raw attribute</p>
<p data-k="witness">{len(items)}</p>

<button data-k="mutate" onclick={mutate}>go</button>
