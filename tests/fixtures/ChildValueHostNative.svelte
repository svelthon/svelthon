<script>
    // The same values handed by a Svelte parent: the witness for ChildValueHost.
    import ChildValueLeaf from './ChildValueLeaf.svelte';

    let { kind = 'price' } = $props();

    const initial = () => ({ nan: NaN, price: 0.5, count: 1, label: 'yes' })[kind];
    const value = initial();

    let bound = $state(initial());
</script>

<ChildValueLeaf {value} other={value} />
<ChildValueLeaf bind:value={bound} other={value} />
