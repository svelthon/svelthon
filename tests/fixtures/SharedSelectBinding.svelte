<script lang="python">
# Two selects bound to one list, one a spread makes multiple and one it leaves
# single, in either order: the list is the multiple one's choices and the
# single one's chosen value.
first: str = "multiple"

original = [None]
picked = original
many = {"multiple": True}
one = {"multiple": False}


@export
def model():
    return [type(picked).__name__, picked is original]
</script>

{#if first == "multiple"}
    <select data-k="multiple" {**many} bind:value={picked}><option value={None}>none</option><option value={0.5}>half</option></select>
    <select data-k="single" {**one} bind:value={picked}><option value={original}>list</option><option value={None}>none</option></select>
{:else}
    <select data-k="single" {**one} bind:value={picked}><option value={original}>list</option><option value={None}>none</option></select>
    <select data-k="multiple" {**many} bind:value={picked}><option value={None}>none</option><option value={0.5}>half</option></select>
{/if}
