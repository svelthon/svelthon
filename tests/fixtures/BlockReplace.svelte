<script lang="python">
# A list a block declares, which a child replaces through a binding and then
# leaves to the block when it goes.
importjs BlockReplaceChild from "./BlockReplaceChild.svelte"
ready = True


def hide():
    global ready
    ready = False
</script>

{#if True}
    {rows = []}
    {#if ready}<BlockReplaceChild bind:rows={rows} />{/if}
    <button data-k="hide" onclick={hide}>hide</button>
    <button data-k="append" onclick={lambda: rows.append(2)}>append</button>
    <output>{len(rows)}</output>
{/if}
