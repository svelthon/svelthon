<script lang="python">
# A callback JavaScript built, handed to a Python component as a prop and as an
# argument to one of its functions: called with Python's 0.25, it receives a
# JavaScript number, as the same callback handed to a module's function does.
callback: object = None


@export
def apply_value(fn):
    return fn(0.25)


@export
def use_prop():
    return callback(0.25)
</script>
