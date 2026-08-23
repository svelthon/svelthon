<script lang="python">
# What a binding can write to besides a name: an attribute, an item, the same
# item reached through the dot, and an item of a row an {#each} handed out.
class Person:
    def __init__(self, name):
        self.name = name


who = Person("ada")
sizes = {"width": "3"}
rows = [{"label": "a"}, {"label": "b"}]
</script>

<input data-k="attr" bind:value={who.name} />
<input data-k="item" bind:value={sizes["width"]} />
<input data-k="dot" bind:value={sizes.width} />

{#each rows as row, i}
    <input data-k="row-{i}" bind:value={row["label"]} />
{/each}

<p data-k="attr-echo">{who.name}</p>
<p data-k="item-echo">{sizes["width"]}</p>
<p data-k="rows-echo">{", ".join(one["label"] for one in rows)}</p>
