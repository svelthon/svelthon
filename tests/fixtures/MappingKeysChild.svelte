<script>
    // Reads the mapping it is handed as JavaScript reads an object.
    let { data } = $props();
</script>

<p>{Object.keys(data).join(',')}|{String(data['7'])}|{JSON.stringify(data)}</p>
