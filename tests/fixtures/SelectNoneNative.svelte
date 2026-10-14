<script>
    // The same select in Svelte, None its `undefined`: the witness for
    // SelectNone.
    let { held = 'none' } = $props();

    const initial = () => (held === 'none' ? [undefined] : [1]);

    let picked = $state.raw(initial());

    export function chosen() {
        return picked.map((one) => one === undefined);
    }
</script>

<select multiple bind:value={picked}><option value={undefined}>none</option><option value={1}>one</option></select>
