<script lang="python">
# A list the parent shares, declared by a block that comes and goes.
shared: object
ready = True


@export
def toggle():
    global ready
    ready = not ready
</script>

{#if ready}
    {rows = shared}
    <output>{len(rows)}</output>
{/if}
