<script lang="python">
# A view released four ways: called, kept as a value and called, through its
# type, and by leaving a `with` block. Its buffer does not change; the view
# does, and the page reads it.
view = memoryview(bytearray(b"ab"))


def shown():
    try:
        return str(len(view))
    except ValueError:
        return "released"


@export
def close(how):
    if how == "called":
        view.release()
    elif how == "kept":
        release = view.release
        release()
    elif how == "through its type":
        memoryview.release(view)
    else:
        with view:
            pass


@export
def held():
    return shown()
</script>

<p>{shown()}</p>
