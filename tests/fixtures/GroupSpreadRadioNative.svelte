<script>
    // The same radio in Svelte, `undefined` for None: the witness for
    // GroupSpreadRadio.
    const attrs = { value: undefined };

    let choice = $state(undefined);

    export function held() {
        return choice === undefined;
    }
</script>

<input type="radio" {...attrs} bind:group={choice} />
