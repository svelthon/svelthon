<script>
    // SnippetRefresh in Svelte.
    import { source, advance, read } from './refresh_source.js';

    let { kind = 'attribute' } = $props();
    let count = $state(0);

    function change() {
        advance();
        count += 1;
    }
</script>

{#snippet card(x)}<button onclick={change}>refresh</button><output>{count + x}</output>{/snippet}

{#if kind === 'attribute'}
    {@render card(source.value)}
{:else}
    {@render card(read())}
{/if}
