<script>
    let { value = $bindable() } = $props();
</script>

<p>{typeof value}|{String(value)}</p>
