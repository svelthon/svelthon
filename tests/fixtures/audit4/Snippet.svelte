<script lang="python">
rows = [1, 2]
</script>

{#snippet row(x)}<li data-k="row">{x * 10}</li>{/snippet}
{#each rows as r}{@render row(r)}{/each}
