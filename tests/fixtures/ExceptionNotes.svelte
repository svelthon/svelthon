<script lang="python">
# An exception's notes, read by the page, added in each way Python allows: the
# method, the method kept as a value, the method reached through the type.
error = ValueError("failure")
noted = ValueError("failure")
noted.add_note("first")


def shown(one):
    return len(getattr(one, "__notes__", []))


@export
def note(way):
    if way == "method":
        error.add_note("extra")
    elif way == "existing":
        noted.add_note("extra")
    elif way == "detached":
        add = error.add_note
        add("extra")
    else:
        BaseException.add_note(error, "extra")
</script>

<p data-k="error">{shown(error)}</p>
<p data-k="noted">{shown(noted)}</p>
