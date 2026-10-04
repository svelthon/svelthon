<script>
    // A JavaScript parent whose snippet reads what it is handed as JavaScript
    // values: a number it formats, an absence, and a callback it calls.
    let { Child } = $props();

    const shown = (value) => {
        try {
            return `${typeof value}:${value.toFixed(2)}`;
        } catch (error) {
            return `${typeof value}:${error.message}`;
        }
    };

    const called = (fn) => {
        try {
            return String(fn(0.25));
        } catch (error) {
            return error.message;
        }
    };
</script>

<Child>
    {#snippet children(value, absence, callback)}
        <p data-k="number">{shown(value)}</p>
        <p data-k="absence">{String(absence == null)}</p>
        <p data-k="callback">{called(callback)}</p>
    {/snippet}
</Child>
