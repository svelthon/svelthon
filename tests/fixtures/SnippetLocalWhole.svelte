<script lang="python">
# A snippet of this markup is Python, so a whole float it is handed stays one.
</script>

{#snippet own(whole)}<p data-k="own">{type(whole).__name__}:{whole}</p>{/snippet}
{@render own(1.0)}
