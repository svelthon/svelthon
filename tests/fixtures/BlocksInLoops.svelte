<script lang="python">
# A style and a script inside a loop are elements of the loop: the names it
# declares reach the expressions after them, and their attributes are markup.
rows = ["Ada"]
shown = True
</script>

{#each rows as row, i}
    <style data-row={row.upper()}>
        .unused { color: red; }
    </style>
    <p data-k="each">{row}:{i}</p>
{/each}
{#if shown}{#each rows as row, i}<style>.unused { color: red; }</style><p data-k="nested">{row}:{i}</p>{/each}{/if}
{#each rows as row, i}<script type="application/json">{"hello":"world"}</script><p data-k="script">{row}:{i}</p>{/each}
