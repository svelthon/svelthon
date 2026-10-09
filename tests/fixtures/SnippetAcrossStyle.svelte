<script module>
    import SnippetReceiver from './SnippetReceiver.svelte';
</script>

<script lang="python">
# Snippets used above a `<style>` and declared below it: one handed to a child,
# one rendered here with an argument whose class is the author's.
class Price(float):
    pass


value = Price(0.5)
</script>

<SnippetReceiver content={row} />
<p data-k="local">{@render priced(value)}</p>

<style>
    p {
        margin: 0;
    }
</style>

{#snippet row()}<span data-k="handed">7</span>{/snippet}
{#snippet priced(item)}{type(item).__name__}{/snippet}
