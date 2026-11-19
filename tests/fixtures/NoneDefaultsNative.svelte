<script>
    // The same patterns in Svelte, `undefined` where Python holds None.
    const pairs = [[{ first: 5 }, undefined], [{ first: 6 }, 7]];
    const keyed = [{ a: undefined }, { a: 2 }];
</script>

{#each pairs as [{ first }, second = first]}<output data-k="pairs">{first}:{second}</output>{/each}
{#each keyed as { a = 1 }}<output data-k="keyed">{a}</output>{/each}
{#snippet line(x = 7)}<output data-k="param">{x}</output>{/snippet}
{@render line(undefined)}{@render line(3)}
