<script lang="python">
# A name only `globals()` binds, which the template reaches through what the
# script defines: a function, a `@derived` and a `=>`.
globals()["future"] = 1


def read():
    return future


@derived
def decorated():
    return future


arrow => future


@export
def write(value):
    globals()["future"] = value
</script>

<p data-k="view">{read()}|{decorated}|{arrow}</p>
