<script lang="python">
# A child that renders whichever snippet it was handed, and gives it an
# argument of its own: what comes out proves the snippet ran here.
row: object = None
header: object = None
</script>

{#if row is not None}{@render row("A")}{/if}
{#if header is not None}{@render header("B")}{/if}
