<script lang="python">
visible = False

if False:
    label = "unused"


def show():
    global visible
    visible = True


@export
def fail():
    raise ValueError("from this panel")
</script>

<button data-act="show" onclick={show}>Show label</button>
<svelte:boundary>
    {#if visible}<output data-flag="ok">{label}</output>{/if}
    {#snippet failed(error)}
        <output data-flag="error">{type(error).__name__}</output>
    {/snippet}
</svelte:boundary>
