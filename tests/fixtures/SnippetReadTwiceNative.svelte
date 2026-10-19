<script>
    // SnippetReadTwice in Svelte.
    import { source, step } from './refresh_source.js';
</script>

{#snippet card(x)}<output>{x - step() - x}</output>{/snippet}

{@render card(source.value)}
