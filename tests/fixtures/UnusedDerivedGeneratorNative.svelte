<script>
    // The same in Svelte: the witness for UnusedDerivedGenerator.
    let unused = $derived.by(() => {
        throw new Error('unused derived was evaluated');
    });

    function* numbers() {
        yield 'a';
        yield 'b';
    }

    const rows = numbers();
</script>

{#each rows as item}<p data-k="row">{item}</p>{/each}
