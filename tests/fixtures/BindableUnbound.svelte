<script lang="python">
# A list, a dict or an instance written into a bindable prop no parent binds,
# which Svelte keeps as its own copy of what the write handed over.
value: object = bindable(None)
kind: str = "list"
written = None


class Box:
    pass


@export
def change():
    global value, written
    written = [2] if kind == "list" else {"n": 2} if kind == "dict" else Box()
    value = written


@export
def same():
    return value is written
</script>

<p>{type(value).__name__}</p>
