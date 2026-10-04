<script lang="python">
# A Python parent binding the same value: what it reads is the float the child
# wrote, `15.0` included.
importjs CrossedFloat from "./CrossedFloat.svelte"

value = 0.25
child = None


@export
def half():
    child.half()


@export
def whole():
    child.whole()
</script>

<CrossedFloat bind:value bind:this={child} />
<p data-k="parent">{type(value).__name__}:{value}</p>
