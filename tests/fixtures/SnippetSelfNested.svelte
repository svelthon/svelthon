<script lang="python">
# A snippet whose body declares a snippet of its own name, handed to a Python
# child: it is announced as itself, and its arguments stay Python's.
importjs SnippetTypesConsumer from "./SnippetTypesConsumer.svelte"
</script>

{#snippet row(value)}
    {#snippet row()}<i>unused</i>{/snippet}
    <output>{type(value).__name__}</output>
{/snippet}

<SnippetTypesConsumer children={row} />
