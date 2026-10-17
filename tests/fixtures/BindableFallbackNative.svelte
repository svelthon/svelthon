<script>
    // The Svelte witness of BindableFallback.svelte, clearing to undefined.
    let { value = $bindable('default') } = $props();

    export const clear = () => {
        value = undefined;
    };
</script>

<p data-k="child">{value}</p>
