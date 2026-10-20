<script>
    // The same component in Svelte, the snippet imported by its name: the
    // witness for StarSnippet.
    import { piece } from './StarSnippetSource.svelte';
</script>

<div data-k="named">{@render piece('named')}</div>
<div data-k="optional">{@render piece?.('optional')}</div>
