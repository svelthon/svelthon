<script>
    // Svelte's witness for SnippetRereads.svelte.
    import { read } from './reread_calls.js';

    let { rows } = $props();
    let revision = $state(0);

    export function bump() {
        revision += 1;
    }
</script>

{#snippet plain(first, id)}<output data-k="plain-{id}">{revision}:{first}</output>{/snippet}
{#snippet keyed({ first }, id)}<output data-k="keyed-{id}">{revision + first}</output>{/snippet}
{#snippet starred([first, ...rest], id)}<output data-k="starred-{id}">{revision + first}</output>{/snippet}
{#snippet counted(value, id)}<output data-k="counted-{id}">{revision}:{read(value)}</output>{/snippet}
{#snippet nested([{ first }], id)}<output data-k="nested-{id}">{revision + first}</output>{/snippet}

{#each rows as row (row.id)}
    {@render plain(row.value, row.id)}
    {@render keyed(row.data, row.id)}
    {@render starred(row.list, row.id)}
    {@render counted(row.id, row.id)}
    {@render nested(row.items, row.id)}
    {#each [row.list] as [head, ...tail]}<output data-k="each-{row.id}">{revision + head}</output>{/each}
    {#each [row.items] as [{ first }]}<output data-k="each-nested-{row.id}">{revision + first}</output>{/each}
{/each}
