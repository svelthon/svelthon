<script>
    // ActionGetter in Svelte.
    let { model, act } = $props();
</script>

<div data-k="action" use:act={model}>action</div>
