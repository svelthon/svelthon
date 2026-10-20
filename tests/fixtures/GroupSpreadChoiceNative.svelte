<script>
    // The same box in Svelte, its value an object of its own, or NaN: the
    // witness for GroupSpreadChoice.
    let { kind = 'price' } = $props();

    const initial = () => ({ nan: NaN, price: { value: 0.5 }, count: { value: 1 }, label: { value: 'yes' }, none: undefined })[kind];
    const value = initial();
    const attrs = { value };

    let picked = $state.raw([value]);

    export function held() {
        return [picked.length, picked.length === 1 && Object.is(picked[0], value)];
    }
</script>

<input type="checkbox" {...attrs} bind:group={picked} />
