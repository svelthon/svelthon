<script module>
    const external = { version: 0 };
</script>

<script>
    // The witness of `EachForeignKey.svelte`: the same rows handed anew.
    let rows = $state([{ id: 1 }]);

    export function step() {
        external.version += 1;
        rows = [...rows];
    }
</script>

{#each rows as row (row.id + ':' + external.version)}<input value="draft" />{/each}
