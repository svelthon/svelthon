<script>
    let rows = ['Ada'];
    let shown = true;
</script>

{#each rows as row, i}
    <style data-row={row.toUpperCase()}>
        .unused { color: red; }
    </style>
    <p data-k="each">{row}:{i}</p>
{/each}
{#if shown}{#each rows as row, i}<style>.unused { color: red; }</style><p data-k="nested">{row}:{i}</p>{/each}{/if}
{#each rows as row, i}<script type="application/json">{"hello":"world"}</script><p data-k="script">{row}:{i}</p>{/each}
