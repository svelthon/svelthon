<script>
    // The witness: the same select in Svelte itself.
    let { kind = 'none', form = 'field' } = $props();
    const made = () => (kind === 'none' ? undefined : kind === 'float' ? 0.5 : { id: 1 });
    const option = made();
    const original = [option];
    let picked = $state.raw(original);
    let attrs = $state({ multiple: true });

    export function swap() {
        if (form === 'whole') attrs = { multiple: !attrs.multiple };
        else attrs.multiple = !attrs.multiple;
    }
</script>

<select {...attrs} bind:value={picked}>
    {#if attrs.multiple}
        <option value={option}>item</option>
    {:else}
        <option value={original}>list</option>
    {/if}
    <option value={9}>other</option>
</select>
