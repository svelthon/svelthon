<script>
    class Row {
        selected = $state([]);
    }

    const shared = new Row();
    let groups = [[shared], [shared]];

    export function read() {
        return groups.flatMap((rows) => rows.map((row) => row.selected.join(','))).join('|');
    }
</script>

{#each groups as rows, outer}
    {#each rows as row}
        <input data-k={String(outer)} type="checkbox" value={String(outer)} bind:group={row.selected} />
    {/each}
{/each}
