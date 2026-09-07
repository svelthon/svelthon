<script lang="python">
# A handler that is a function of another module. Read from Python, it arrives
# wrapped by Brython's interop, and that wrapper answers for its own signature —
# which is not the one the author declared.
import handler_mod

seen = 0
args = -1


def refresh():
    global seen, args
    seen = handler_mod.seen
    args = handler_mod.args
</script>

<button data-k="none" onclick={handler_mod.bump}>no parameter</button>
<button data-k="one" onclick={handler_mod.one}>one parameter</button>
<button data-k="refresh" onclick={refresh}>refresh</button>

<p data-k="seen">{seen}</p>
<p data-k="args">{args}</p>
