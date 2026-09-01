<script module>
    import ShorthandChild from './ShorthandChild.svelte';
</script>

<script lang="python">
attrs = {"data-n": "0"}
labels = []
word = "Active"
rows = []


def mutate_attrs():
    attrs["data-n"] = "1"


def mutate_rows():
    rows.append("x")
</script>

<!-- An apostrophe — don't break — must break nothing below. -->
<p data-k="text">{labels}</p>
<p data-k="cite" class="tag {word.lower()}" title="n={len(labels)}">quoted</p>
<p data-k="witness">{attrs}</p>
<p data-k="spread" {**attrs}>spread</p>
<p data-k="parent">{rows}</p>
<ShorthandChild {rows} />

<button data-k="mutate_attrs" onclick={mutate_attrs}>attrs</button>
<button data-k="mutate_rows" onclick={mutate_rows}>rows</button>
