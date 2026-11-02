<svelte:options customElement="undefined-prop-element-native" />

<script>
    // The same element in Svelte's own language.
    let { amount = 1.5 } = $props();
</script>

<p>{amount}</p>
