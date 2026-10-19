<script>
    import ShadowedSnippet from './ShadowedSnippet.svelte';

    let { kind } = $props();
</script>

{#snippet foreign(value)}<output>{typeof value}:{String(value)}</output>{/snippet}
<ShadowedSnippet other={foreign} {kind} />
