<script lang="python">
# A Python parent binding a child it holds by a name it assigned, Python or
# Svelte, and clearing it.
importjs Child from "./BindableFallback.svelte"
importjs Native from "./BindableFallbackNative.svelte"

python: bool = True
Picked = Child if python else Native
value = "start"
child = None


@export
def clear():
    child.clear()


@export
def set(next):
    global value
    value = next
</script>

<Picked bind:value bind:this={child} />
<p data-k="parent">{value}</p>
