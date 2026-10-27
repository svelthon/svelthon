<script lang="python">
# Fields a pattern unpacks from objects JavaScript holds and changes in place,
# with no signal of Svelte's: each is read again where it is read, as Svelte
# reads one, so that a render the counter asks for shows the field as it is.
source: object
nested: object
pair: object
tick = 0


@export
def advance():
    global tick
    tick += 1
</script>

{#snippet keyed({value})}
    <output data-k="snippet-key">{tick + value}</output>
{/snippet}
{#snippet deep({item: {value}})}
    <output data-k="snippet-nested">{tick + value}</output>
{/snippet}
{#snippet indexed([value])}
    <output data-k="snippet-index">{tick + value}</output>
{/snippet}
{@render keyed(source)}
{@render deep(nested)}
{@render indexed(pair)}
{#each [source] as {value}}
    <output data-k="each-key">{tick + value}</output>
{/each}
