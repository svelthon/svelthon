<script>
    // The witness of `RestRows.svelte` for the rows JavaScript hands over.
    import { records } from './rest_rows.js';

    const rows = [
        ['record', records[0]],
        ['class', records[1]]
    ];
</script>

{#each rows as [kind, row]}
    {#each [row] as { first: selected, ...rest }}
        <p data-k={kind}>{selected}|{Object.keys(rest).join(',')}</p>
    {/each}
{/each}
