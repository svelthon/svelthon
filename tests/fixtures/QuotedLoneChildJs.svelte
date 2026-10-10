<script>
    let { data } = $props();
</script>

<output>{Array.isArray(data) ? 'array' : typeof data}</output>
