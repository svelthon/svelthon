<script lang="python">
# Names the template declares in one spelling and reads in another that Python
# takes for the same name (NFKC): a snippet's parameter both ways, an each item,
# index and key, an await value, a template rune, a snippet rendered in a block.
rows = [10, 20]


async def later():
    return 5
</script>

{#snippet cell(ﬁle)}<b>{file}</b>{/snippet}
{#snippet back(file)}<b>{ﬁle}</b>{/snippet}
<p data-k="snippet">{@render cell(3)}</p>
<p data-k="snippet back">{@render back(4)}</p>
<p data-k="each item">{#each rows as ﬁrst}<i>{first}</i>{/each}</p>
<p data-k="each index">{#each rows as row, ｉ}<i>{ｉ}{i}</i>{/each}</p>
<p data-k="each key">{#each rows as ﬁrst (first)}<i>{first}</i>{/each}</p>
<p data-k="await">{#await later() then ｖal}<i>{val}</i>{/await}</p>
<p data-k="rune">{ｔotal = 7}<i>{total}</i></p>
<p data-k="nested snippet">{#each rows as ﬁrst}{@render cell(first)}{/each}</p>
