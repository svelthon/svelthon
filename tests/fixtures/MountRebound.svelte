<script lang="python">
# An `on_mount` the component binds to another function after it is made and
# before the first flush.
record: object


def first():
    record("first")
    return lambda: record("clean:first")


def second():
    record("second")
    return lambda: record("clean:second")


on_mount = first


@export
def replace():
    global on_mount
    on_mount = second
</script>

<p>ready</p>
