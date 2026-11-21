<script>
    class Row {
        selected = $state([]);
    }

    const shared = new Row();
    let groups = [
        { key: '0', rows: [shared] },
        { key: '1', rows: [shared] }
    ];

    export function read() {
        return groups.flatMap((group) => group.rows.map((row) => row.selected.join(','))).join('|');
    }
</script>

{#each groups as group, i}
    {#each group.rows as row, i}
        <input data-k={group.key} type="checkbox" value={group.key} bind:group={row.selected} />
    {/each}
{/each}
