<script>
    // The same options in Svelte, each the number or the string its Python value
    // crosses as: the witness for SelectSubclassChoice.
    let { kind = 'price', many = false } = $props();

    const initial = () => {
        const plain = { price: 0.5, count: 1, label: 'yes' }[kind];

        return { plain, start: many ? [plain] : plain };
    };

    const { plain, start } = initial();

    let picked = $state.raw(start);
</script>

{#if many}<select multiple bind:value={picked}><option value={plain}>special</option><option value={plain}>plain</option></select>
{:else}<select bind:value={picked}><option value={plain}>special</option><option value={plain}>plain</option></select>{/if}
