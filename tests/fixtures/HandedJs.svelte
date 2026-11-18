<script>
    // The same forwarder in Svelte.
    import HandedLeaf from './HandedLeaf.svelte';

    let { obj, rows, tick } = $props();
    const Shown = HandedLeaf;
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
