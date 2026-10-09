<script module>
    import SnippetReceiver from '../SnippetReceiver.svelte';
</script>

<script lang="python">
# Snippets used above a list and a paragraph whose closing tags are left out,
# and declared below them: Svelte has closed both by then, so the snippets
# stand at the top level, hoisted across the component.
class Price(float):
    pass


value = Price(0.5)
</script>

<SnippetReceiver content={row} />
<p data-k="local">{@render priced(value)}</p>
<ul><li>a<li>b</ul>
<p>intro<div>block</div>
{#snippet row()}<span data-k="handed">7</span>{/snippet}
{#snippet priced(item)}{type(item).__name__}{/snippet}
