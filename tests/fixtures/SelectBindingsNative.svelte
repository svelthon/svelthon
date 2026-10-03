<script>
    // The same selects written in Svelte, the witness for `SelectBindings`.
    // `$state.raw`, so an object held is the very one an option carries.
    import { untrack } from 'svelte';

    let { kind = 'float' } = $props();

    const values = untrack(() =>
        kind === 'float' ? [0.25, 0.5] : kind === 'int' ? [1, 2] : [{ id: 0.25 }, { id: 0.5 }]
    );

    let picked = $state.raw([values[0]]);
    let value = $state.raw(values[0]);

    export function second() {
        picked = [values[1]];
        value = values[1];
    }

    export function held() {
        const many = values.flatMap((one, i) => (picked.includes(one) ? [i] : []));
        const single = values.flatMap((one, i) => (one === value ? [i] : []));
        return JSON.stringify([many, single, true]);
    }
</script>

<select data-k="many" multiple bind:value={picked}>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="after" bind:value={picked} multiple>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="long" bind:value={value}>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="short" bind:value>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
