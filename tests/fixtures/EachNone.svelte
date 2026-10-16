<script lang="python">
# A list not handed over yet: None, walked by an `{#each}` with and without its
# `{:else}`.
items = None
</script>

<p data-k="plain">{#each items as one}<i>{one}</i>{/each}</p>
<p data-k="else">{#each items as one}<i>{one}</i>{:else}<b>empty</b>{/each}</p>
