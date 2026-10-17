<script>
    // A JavaScript child with a default, and one with none it binds.
    let { value = 99, bound = $bindable(), label = '' } = $props();
</script>

<output data-k={label}>{typeof value}|{String(value)}|{typeof bound}</output>
