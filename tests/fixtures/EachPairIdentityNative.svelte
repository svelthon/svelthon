<script>
    // The witness of `EachPairIdentity.svelte`: new pairs at each walk, keyed
    // by themselves, or the first by its index.
    let { keying = 'identity' } = $props();
    let version = $state(0);
    const values = ['a', 'b'];

    function rows() {
        const unused = version;
        return values.map((value, index) => [index, value]);
    }

    export function step() {
        version++;
    }
</script>

{#each rows() as pair (keying === 'mixed' && pair[0] === 0 ? pair[0] : pair)}<input aria-label={String(pair)} />{/each}
