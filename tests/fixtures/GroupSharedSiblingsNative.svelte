<script>
    class Row {
        selected = $state([]);
    }

    const shared = new Row();
    let rows = [shared];

    export function read() {
        return [...rows, ...rows].map((row) => row.selected.join(',')).join('|');
    }
</script>

{#each rows as row}
    <input data-k="0" type="checkbox" value="0" bind:group={row.selected} />
{/each}
{#each rows as row}
    <input data-k="1" type="checkbox" value="1" bind:group={row.selected} />
{/each}
