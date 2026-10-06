<script>
    let { given } = $props();
</script>

<p data-k="bytes">{given instanceof Uint8Array} {[...given].join(',')}</p>
