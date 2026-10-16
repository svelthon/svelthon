<script lang="python">
# A method read off a JavaScript object and handed to Svelte as a callback: an
# event handler, an attachment, a transition.
model: object = None
shown = False


@export
def show():
    global shown
    shown = True
</script>

<button onclick={model.handler}>press</button>
<div data-k="attach" {@attach model.fn}></div>
{#if shown}
    <div data-k="transition" in:model.fn></div>
{/if}
