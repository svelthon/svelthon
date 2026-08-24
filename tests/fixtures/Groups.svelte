<script lang="python">
# `bind:group` on the three shapes that used to fail differently, plus one group
# per row of an {#each} — the case Svelte's own group identity cannot express.
class Box:
    def __init__(self, pick):
        self.pick = pick


name = "a"
form = {"pick": "a"}
box = Box("a")

tags = []
sheet = {"tags": []}
basket = Box([])

rows = [{"pick": "a"}, {"pick": "b"}]
</script>

{#each ["a", "b", "c"] as one}
    <input data-k="n-{one}" type="radio" bind:group={name} value={one} />
{/each}
<p data-k="name">{name}</p>

{#each ["a", "b", "c"] as one}
    <input data-k="d-{one}" type="radio" bind:group={form.pick} value={one} />
{/each}
<p data-k="dict">{form["pick"]}</p>

{#each ["a", "b", "c"] as one}
    <input data-k="o-{one}" type="radio" bind:group={box.pick} value={one} />
{/each}
<p data-k="obj">{box.pick}</p>

{#each ["a", "b", "c"] as one}
    <input data-k="t-{one}" type="checkbox" bind:group={tags} value={one} />
{/each}
<p data-k="tags">{tags}</p>
<p data-k="tags-type">{type(tags).__name__}</p>

{#each ["a", "b", "c"] as one}
    <input data-k="s-{one}" type="checkbox" bind:group={sheet.tags} value={one} />
{/each}
<p data-k="sheet">{sheet["tags"]}</p>

{#each ["a", "b", "c"] as one}
    <input data-k="k-{one}" type="checkbox" bind:group={basket.pick} value={one} />
{/each}
<p data-k="basket">{basket.pick}</p>

{#each rows as row, i}
    {#each ["a", "b", "c"] as one}
        <input data-k="r{i}-{one}" type="radio" bind:group={row.pick} value={one} />
    {/each}
{/each}
<p data-k="rows">{rows[0]["pick"]}/{rows[1]["pick"]}</p>
