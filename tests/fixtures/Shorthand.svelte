<script module>
    import ShorthandChild from './ShorthandChild.svelte';
</script>

<script lang="python">
attrs = {"data-n": "0"}
labels = []
mot = "Actif"
rows = []


def mutate_attrs():
    attrs["data-n"] = "1"


def mutate_rows():
    rows.append("x")
</script>

<!-- Une apostrophe — aujourd'hui — ne doit rien casser en dessous. -->
<p data-k="text">{labels}</p>
<p data-k="cite" class="tag {mot.lower()}" title="n={len(labels)}">cité</p>
<p data-k="spread" {...attrs}>étalé</p>
<p data-k="parent">{rows}</p>
<ShorthandChild {rows} />

<button data-k="mutate_attrs" onclick={mutate_attrs}>attrs</button>
<button data-k="mutate_rows" onclick={mutate_rows}>rows</button>
