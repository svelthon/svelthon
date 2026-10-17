<script lang="python">
# BindableFallbackPyHost.svelte binding a Svelte child.
importjs Child from "./BindableFallbackNative.svelte"

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
