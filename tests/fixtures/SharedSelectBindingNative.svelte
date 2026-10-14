<script>
    // The same two selects in Svelte, None its `undefined`: the witness for
    // SharedSelectBinding.
    let { first = 'multiple' } = $props();

    const original = [undefined];
    const many = { multiple: true };
    const one = { multiple: false };

    let picked = $state.raw(original);

    export function model() {
        return [Array.isArray(picked) ? 'list' : typeof picked, picked === original];
    }
</script>

{#if first === 'multiple'}
    <select data-k="multiple" {...many} bind:value={picked}><option value={undefined}>none</option><option value={0.5}>half</option></select>
    <select data-k="single" {...one} bind:value={picked}><option value={original}>list</option><option value={undefined}>none</option></select>
{:else}
    <select data-k="single" {...one} bind:value={picked}><option value={original}>list</option><option value={undefined}>none</option></select>
    <select data-k="multiple" {...many} bind:value={picked}><option value={undefined}>none</option><option value={0.5}>half</option></select>
{/if}
