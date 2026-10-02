<script>
    // A JavaScript child calling the callback it is given, with its own number
    // and an argument more than the Python side declares.
    let { cb, config } = $props();

    const call = (fn) => {
        try {
            return String(fn(0.5, 'extra'));
        } catch (error) {
            return `error: ${error.message}`;
        }
    };
</script>

<p data-k="direct">{call(cb)}</p>
<p data-k="nested">{call(config.cb)}</p>
