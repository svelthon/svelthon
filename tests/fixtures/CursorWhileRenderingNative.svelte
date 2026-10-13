<script>
    // The same cursor in Svelte, held in `$state`: the witness for
    // CursorWhileRendering.
    let { listed = false } = $props();

    const cursor = $state({
        items: ['a', 'b'],
        index: 0,
        [Symbol.iterator]() {
            return this;
        },
        next() {
            if (this.index >= this.items.length) return { done: true, value: undefined };

            const value = this.items[this.index];

            this.index += 1;

            return { done: false, value };
        }
    });

    // Read once, at init, as the Python script reads its names.
    const initial = () => (listed ? [...cursor] : cursor);
    const rows = initial();
</script>

{#each rows as item}<p data-k="row">{item}</p>{/each}
