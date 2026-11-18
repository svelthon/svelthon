<script lang="python">
# A JavaScript parent's record, read in a loop's row, a snippet's parameter and
# a spread, beside a count that renders the page again.
entry: object
rows: object
tick: int
</script>

{#each rows as row}<a data-k="row" href={row.url}>Open {row.id} ({tick})</a>{/each}
{#snippet link(one)}<a data-k="snippet" href={one.url}>Open {one.id} ({tick})</a>{/snippet}
{@render link(entry)}
<button data-k="spread" {**entry.action} data-step={tick}>Save {tick}</button>
