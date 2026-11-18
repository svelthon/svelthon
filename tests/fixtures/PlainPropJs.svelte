<script>
    // The same child in Svelte.
    let { obj, count } = $props();
</script>

<p data-x={obj.name}>{obj.name}|{count}</p>
<b>{obj.name + '!'}</b>
<svelte:boundary><i>{obj.name}|{count}</i></svelte:boundary>
