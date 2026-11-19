<script lang="python">
# A Python forwarder handing a JavaScript record's fields to a Svelte child and
# to a Python one: named, spread, between quotes, from a row and a snippet's
# parameter, as a CSS property, and to a child the script holds; and in a sum,
# which Svelte holds.
importjs HandedLeaf from "./HandedLeaf.svelte"
importjs HandedLeafPy from "./HandedLeafPy.svelte"
obj: object
rows: object
tick: int

Shown = HandedLeaf
ShownPy = HandedLeafPy
suffix = "!"
</script>

<HandedLeaf id="named" href={obj.href} name={obj.name} {tick} />
<HandedLeaf id="spread" {**obj.links} {tick} />
<HandedLeaf id="quoted" href="/record/{obj.name}" name="Open {obj.name}" {tick} />
{#each rows as row}<HandedLeaf id="row" href={row.href} name={row.name} {tick} />{/each}
{#snippet line(one)}<HandedLeaf id="snippet" href={one.href} name={one.name} {tick} />{/snippet}
{@render line(obj)}
<HandedLeaf id="css" --theme={obj.color} --revision={tick} {tick} />
<Shown id="held" href={obj.href} name={obj.name} {tick} />
<HandedLeaf id="sum" name={obj.name + suffix} {tick} />
<HandedLeaf id="mixed" name="{obj.name}{suffix + ''}" {tick} />
<HandedLeafPy id="named-py" href={obj.href} name={obj.name} {tick} />
<HandedLeafPy id="spread-py" {**obj.links} {tick} />
<HandedLeafPy id="quoted-py" href="/record/{obj.name}" name="Open {obj.name}" {tick} />
{#each rows as row}<HandedLeafPy id="row-py" href={row.href} name={row.name} {tick} />{/each}
{#snippet linePy(one)}<HandedLeafPy id="snippet-py" href={one.href} name={one.name} {tick} />{/snippet}
{@render linePy(obj)}
<HandedLeafPy id="css-py" --theme={obj.color} --revision={tick} {tick} />
<ShownPy id="held-py" href={obj.href} name={obj.name} {tick} />
<HandedLeafPy id="sum-py" name={obj.name + suffix} {tick} />
<HandedLeafPy id="mixed-py" name="{obj.name}{suffix + ''}" {tick} />
