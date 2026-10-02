<script lang="python">
# A ticked checkbox whose block goes away, beside one that stays.
shown = True
selected = []


def hide():
    global shown
    shown = False
</script>

<button onclick={hide}>hide</button>
{#if shown}
    <input data-k="gone" type="checkbox" value="gone" bind:group={selected} />
{/if}
<input data-k="kept" type="checkbox" value="kept" bind:group={selected} />
<p>{",".join(selected)}</p>
