<script lang="python">
# A Python parent binding a Python child's prop, and clearing it.
importjs Child from "./BindableFallback.svelte"

empty: bool = False
value = None if empty else "start"
child = None


@export
def clear():
    child.clear()


@export
def set(next):
    global value
    value = next
</script>

<Child bind:value bind:this={child} />
<p data-k="parent">{value}</p>
