<script>
    import SnippetReceiver from '../SnippetReceiver.svelte';

    class Price extends Number {}

    let value = new Price(0.5);
</script>

<SnippetReceiver content={row} />
<p data-k="local">{@render priced(value)}</p>
<ul><li>a<li>b</ul>
<p>intro<div>block</div>
{#snippet row()}<span data-k="handed">7</span>{/snippet}
{#snippet priced(item)}{item.constructor.name}{/snippet}
