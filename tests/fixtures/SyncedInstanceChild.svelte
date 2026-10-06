<script>
    let { given } = $props();
</script>

<p data-k="count">{given.count}</p>
<button data-k="add" onclick={() => (given.count += 10)}>add</button>
