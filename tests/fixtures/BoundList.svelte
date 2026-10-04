<script lang="python">
# A list a JavaScript parent binds, replaced and then grown by the child.
rows: list = bindable([])


@export
def reset():
    global rows
    rows = []


@export
def grow():
    rows.append(8)
</script>

<p data-k="child">{",".join(str(one) for one in rows)}</p>
