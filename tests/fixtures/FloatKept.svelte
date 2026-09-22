<script lang="python">
# A float the markup hands to Svelte and Python then reads again: each place
# the value goes back into Python, and one where it goes out to the DOM.
half = 0.5
</script>

{#each [[half]] as [a, b=a]}<i data-k="default">{type(b).__name__}:{b * 2}</i>{/each}
{#if True}{x = 0.5}<i data-k="declared">{type(x).__name__}:{x * 2}</i>{/if}
{#if True}{y = half}<i data-k="declared-name">{type(y).__name__}:{y * 2}</i>{/if}

{#snippet row(price)}<i data-k="render">{type(price).__name__}:{price * 2}</i>{/snippet}
{@render row(half)}

<!-- Out to the DOM, where it has to be a JavaScript number. -->
<progress data-k="attribute" value={half}></progress>
