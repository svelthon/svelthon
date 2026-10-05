<script lang="python">
# A comprehension holding an `await`, in `on_mount`: the page shows the list.
shown = ""


async def double(v):
    return 2 * v


async def on_mount():
    global shown
    values = [await double(x) for x in range(3)]
    shown = repr(values)
</script>

<p>{shown}</p>
