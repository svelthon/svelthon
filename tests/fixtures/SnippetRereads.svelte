<script lang="python">
# Snippet parameters and the names a pattern takes, read where they are read:
# a JavaScript row changed in place, then rendered again for another reason.
# And a call the author wrote held until what it reads changes. The witness is
# `SnippetRereadsNative.svelte`.
importjs { read } from "./reread_calls.js"

rows: object
revision = 0


@export
def bump():
    global revision
    revision += 1
</script>

{#snippet plain(first, id)}<output data-k={f"plain-{id}"}>{revision}:{first}</output>{/snippet}
{#snippet keyed({first}, id)}<output data-k={f"keyed-{id}"}>{revision + first}</output>{/snippet}
{#snippet starred([first, *rest], id)}<output data-k={f"starred-{id}"}>{revision + first}</output>{/snippet}
{#snippet counted(value, id)}<output data-k={f"counted-{id}"}>{revision}:{read(value)}</output>{/snippet}
{#snippet nested([{first}], id)}<output data-k={f"nested-{id}"}>{revision + first}</output>{/snippet}

{#each rows as row (row.id)}
    {@render plain(row.value, row.id)}
    {@render keyed(row.data, row.id)}
    {@render starred(row.list, row.id)}
    {@render counted(row.id, row.id)}
    {@render nested(row.items, row.id)}
    {#each [row.list] as [head, *tail]}<output data-k={f"each-{row.id}"}>{revision + head}</output>{/each}
    {#each [row.items] as [{first}]}<output data-k={f"each-nested-{row.id}"}>{revision + first}</output>{/each}
{/each}
