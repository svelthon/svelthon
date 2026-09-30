<script module>
    import PropDefaults from './PropDefaults.svelte';
</script>

<script lang="python">
# A Python parent binding the child's bindable list.
items = [1]
child = None


@export
def parent_view():
    return f"{items}|{type(items).__name__}"


@export
def child_mutate():
    child.mutate()


@export
def child_reassign():
    child.reassign()
</script>

<PropDefaults bind:rows={items} bind:this={child} />
<p data-k="parent">{items}</p>
