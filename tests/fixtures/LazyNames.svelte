<script lang="python">
# A derived runs when its value is read, and only then: listing or counting
# the names of the module reads no value, and reading one does.
@derived
def dangerous():
    raise ValueError("derived should stay lazy")


@export
def names():
    return ["dangerous" in globals().keys(), "dangerous" in list(globals()), len(globals()) > 0]


@export
def reversed_names():
    return ["dangerous" in list(reversed(globals())), "dangerous" in list(reversed(globals().keys()))]


@export
def reversed_values():
    try:
        return list(reversed(globals().values()))
    except ValueError:
        return "read"


@export
def values():
    try:
        return list(globals().values())
    except ValueError:
        return "read"
</script>

<p>ready</p>
