<script lang="python">
# What `09-transitions/04-custom-js-transitions` writes: a transition returning a
# duration and a tick, both computed in Python.
visible = False
calls = []

def grow(node, params):
    def tick(t, u):
        calls.append(t)
    return {"duration": 300, "tick": tick}
</script>

<button onclick={lambda e: globals().__setitem__("visible", not visible)}>go</button>
{#if visible}<p transition:grow data-k="p">x</p>{/if}
<span data-k="calls">{len(calls)}</span>
