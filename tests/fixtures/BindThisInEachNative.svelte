<script>
    // Svelte's witness for BindThisInEach.svelte.
    class Holder {
        ref = $state(null);
        constructor(name) {
            this.name = name;
        }
    }

    const rows = $state([{ name: 'a', ref: null }, { name: 'b', ref: null }]);
    const held = [new Holder('c'), new Holder('d')];

    export function bound() {
        return [...rows.map((row) => row.ref.dataset.k), ...held.map((one) => one.ref.dataset.k)];
    }
</script>

{#each rows as row (row.name)}<div data-k={row.name} bind:this={row.ref}></div>{/each}
{#each held as one (one.name)}<input data-k={one.name} bind:this={one.ref} />{/each}
