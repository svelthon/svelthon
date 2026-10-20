<script module>
    // A snippet a Svelte file exports, which a Python module re-exports.
    export { piece };
</script>

{#snippet piece(label = 'hello')}
    <output>{label}</output>
{/snippet}
