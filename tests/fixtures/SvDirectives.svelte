<script module>
    import Card from './SvCard.svelte';

    const later = Promise.resolve('resolved');

    function mark(node, text) {
        node.setAttribute('data-action', text);
        return { destroy() {} };
    }
</script>

<script lang="python">
width = 0
props = {"title": "spread"}
</script>

<svelte:window bind:innerWidth={width} />

<p data-k="await">{#await later}waiting{:then v}{v}{:catch e}failed{/await}</p>
<p data-k="action" use:mark={'ok'}>a</p>
<p data-k="width">{width}</p>
<p data-k="scoped">scoped</p>

<Card {...props}>
    {#snippet children()}<i>x</i>{/snippet}
</Card>

<style>
    p { color: rgb(1, 2, 3); }
</style>
