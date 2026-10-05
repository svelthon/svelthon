<script>
    // The witness of `ClassMap.svelte`.
    let { classes = null } = $props();
</script>

<p data-k="direct" class={classes}>hi</p>
<p data-k="spread" {...{ class: classes }}>hi</p>
