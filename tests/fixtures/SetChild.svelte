<script>
    let { picked } = $props();
</script>

<p data-k="picked">{[...picked].sort().join(',')} {picked.size} {picked.has('b')}</p>
