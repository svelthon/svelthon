<script>
    // A JavaScript child doing arithmetic on what it is handed: a config's
    // number and a number of its own.
    let { label, config, scalar } = $props();

    const seen = (value) => (typeof value === 'number' ? value.toFixed(2) : `not a number: ${typeof value}`);
</script>

<p data-k={label}>{seen(config.rate)}|{seen(scalar)}</p>
