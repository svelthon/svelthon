<script module>
    import Card from './SvCard.svelte';

    const later = Promise.resolve('résolu');

    function mark(node, text) {
        node.setAttribute('data-action', text);
        return { destroy() {} };
    }
</script>

<script lang="python">
width = 0
props = {"title": "étalé"}
</script>

<svelte:window bind:innerWidth={width} />

<p data-k="await">{#await later}attente{:then v}{v}{:catch e}erreur{/await}</p>
<p data-k="action" use:mark={'ok'}>a</p>
<p data-k="width">{width}</p>
<p data-k="scoped">scopé</p>

<Card {...props}>
    {#snippet children()}<i>x</i>{/snippet}
</Card>

<style>
    p { color: rgb(1, 2, 3); }
</style>
