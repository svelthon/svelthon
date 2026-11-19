<script lang="python">
# Defaults that are floats of an integral value, which cross as the int a
# parent may pass: one the child never writes, one it writes.
scale: float = 1.0
ratio: float = 2.0


@export
def write(value):
    global ratio
    ratio = value


@export
def model():
    return f"{type(scale).__name__} {scale!r}|{type(ratio).__name__} {ratio!r}"
</script>

<p>{type(scale).__name__} {repr(scale)}|{type(ratio).__name__} {repr(ratio)}</p>
