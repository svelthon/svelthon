<script>
    // The same select in Svelte, None its `undefined` and `javascript.NULL` its
    // `null`: the witness for SelectNone.
    let { held = 'none' } = $props();

    const initial = () => (held === 'none' ? [undefined] : held === 'null' ? [null] : [1]);

    let picked = $state.raw(initial());

    export function chosen() {
        return picked.map((one) => [one === undefined, one === null]);
    }
</script>

<select multiple bind:value={picked}><option value={undefined}>none</option><option value={null}>null</option><option value={1}>one</option></select>
