<script>
    // The same object in Svelte, whose group collects into a `Set`: the witness
    // for GroupSameObject. Raw, so the array holds the object itself, as the
    // Python list does.
    let { initial = false } = $props();

    const choice = {};
    const start = () => (initial ? [choice] : []);

    let picked = $state.raw(start());

    export function held() {
        return [picked.length, picked.includes(choice)];
    }
</script>

<input data-k="a" type="checkbox" value={choice} bind:group={picked} />
<input data-k="b" type="checkbox" value={choice} bind:group={picked} />
