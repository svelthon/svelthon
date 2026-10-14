<script>
    // The same select in Svelte, None its `undefined`: the witness for
    // SpreadMultiple.
    let { held = 'none', spread = true } = $props();

    const attrs = { multiple: true };
    const initial = () => (held === 'none' ? [undefined] : [0.5]);

    let picked = $state.raw(initial());

    export function model() {
        return Array.isArray(picked) ? 'list' : typeof picked;
    }
</script>

{#if spread}<select {...attrs} bind:value={picked}><option value={undefined}>none</option><option value={0.5}>half</option></select>
{:else}<select multiple bind:value={picked}><option value={undefined}>none</option><option value={0.5}>half</option></select>{/if}
