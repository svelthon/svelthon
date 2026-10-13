<script>
    // The same markup in Svelte: the witness for SnippetAttribute.
    import { createRawSnippet } from 'svelte';

    const holder = { fn: createRawSnippet(() => ({ render: () => '<p data-k="raw">ok</p>' })) };
    const bundle = { fn: holder.fn };
    const missing = { fn: undefined };
</script>

{#snippet row(value)}<p data-k="own">{typeof value}:{value}</p>{/snippet}
{let held = $state.raw({ fn: row })}
{@render holder.fn()}
{@render holder.fn?.()}
{@render bundle['fn']()}
{@render missing.fn?.()}
{@render held.fn(1.0)}
