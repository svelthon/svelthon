<script>
    // The witness: an instance of the author's class whose field is state,
    // shared by both rows.
    class Row {
        selected = $state([]);
    }

    const shared = new Row();
    let rows = [shared, shared];

    export function read() {
        return rows.map((row) => row.selected.join(',')).join('|');
    }
</script>

{#each rows as row, at}
    <input data-k={String(at)} type="checkbox" value={String(at)} bind:group={row.selected} />
{/each}
