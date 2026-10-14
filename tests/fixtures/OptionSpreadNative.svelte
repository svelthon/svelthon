<script>
    // The same option in Svelte, each value the number or the string its Python
    // value crosses as: the witness for OptionSpread.
    let { kind = 'float', many = false } = $props();

    const initial = () => {
        const choice = { float: 0.5, int: 1, str: 'yes', nan: NaN, price: 0.5, count: 1, label: 'yes' }[kind];

        return { attrs: { value: choice }, start: many ? [choice] : choice };
    };

    const { attrs, start } = initial();

    let picked = $state.raw(start);
</script>

{#if many}<select multiple bind:value={picked}><option {...attrs}>one</option></select>
{:else}<select bind:value={picked}><option {...attrs}>one</option></select>{/if}
