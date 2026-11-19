<script>
    // The same forwarder in Svelte.
    import HandedLeaf from './HandedLeaf.svelte';
    import HandedLeafPy from './HandedLeafPy.svelte';

    let { obj, rows, tick } = $props();
    const Shown = HandedLeaf;
    const ShownPy = HandedLeafPy;
    const suffix = '!';
</script>

<HandedLeaf id="named" href={obj.href} name={obj.name} {tick} />
<HandedLeaf id="spread" {...obj.links} {tick} />
<HandedLeaf id="quoted" href="/record/{obj.name}" name="Open {obj.name}" {tick} />
{#each rows as row}<HandedLeaf id="row" href={row.href} name={row.name} {tick} />{/each}
{#snippet line(one)}<HandedLeaf id="snippet" href={one.href} name={one.name} {tick} />{/snippet}
{@render line(obj)}
<HandedLeaf id="css" --theme={obj.color} --revision={tick} {tick} />
<Shown id="held" href={obj.href} name={obj.name} {tick} />
<HandedLeaf id="sum" name={obj.name + suffix} {tick} />
<HandedLeaf id="mixed" name="{obj.name}{suffix + ''}" {tick} />
<HandedLeafPy id="named-py" href={obj.href} name={obj.name} {tick} />
<HandedLeafPy id="spread-py" {...obj.links} {tick} />
<HandedLeafPy id="quoted-py" href="/record/{obj.name}" name="Open {obj.name}" {tick} />
{#each rows as row}<HandedLeafPy id="row-py" href={row.href} name={row.name} {tick} />{/each}
{#snippet linePy(one)}<HandedLeafPy id="snippet-py" href={one.href} name={one.name} {tick} />{/snippet}
{@render linePy(obj)}
<HandedLeafPy id="css-py" --theme={obj.color} --revision={tick} {tick} />
<ShownPy id="held-py" href={obj.href} name={obj.name} {tick} />
<HandedLeafPy id="sum-py" name={obj.name + suffix} {tick} />
<HandedLeafPy id="mixed-py" name="{obj.name}{suffix + ''}" {tick} />
