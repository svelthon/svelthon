<svelte:options customElement={{ tag: 'bindable-fallback-element-native', shadow: 'none' }} />

<script>
    // The Svelte witness of BindableFallbackElement.svelte, its float a number.
    let { value = 'default', ratio = 15 } = $props();

    function clear() {
        value = undefined;
    }
</script>

<p data-k="child">{value}|{ratio}</p>
<button onclick={clear}>clear</button>
