<script>
    // The same values in Svelte, each the number or the string its Python value
    // crosses as: the witness for ElementValueProperty.
    let { kind = 'price', form = 'direct' } = $props();

    const initial = () => ({ nan: NaN, price: 0.5, count: 1, label: 'yes', float: 0.5 })[kind];
    const value = initial();
</script>

{#if form === 'direct'}<value-property {value}></value-property>{:else}<value-property {...{ value }}></value-property>{/if}
