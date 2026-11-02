<script>
    // ActionPayload in Svelte.
    let { act, value } = $props();
</script>

<div use:act={value}>action</div>
