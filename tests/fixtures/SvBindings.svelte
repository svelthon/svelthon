<script module>
    import Card from './SvCard.svelte';
</script>

<script lang="python">
done = True
pick = "b"
node = None
opts = ["a", "b"]

def grab(el):
    global node
    node = el
</script>

<input data-k="chk" type="checkbox" bind:checked={done} />
<p data-k="chkv">{done}</p>

<input data-k="radio" type="radio" bind:group={pick} value="a" />
<p data-k="pick">{pick}</p>

<p data-k="this" bind:this={node}>ancre</p>
<p data-k="thisv">{node}</p>

<Card title="Hello">
    {#snippet children()}<em>content</em>{/snippet}
</Card>
