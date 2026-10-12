<script lang="python">
# An exception's notes, read by the page, added in each way Python allows: the
# method, the method kept as a value, the method reached through the type. And
# what the engine writes on an exception as it raises it: its cause, its
# context and its traceback.
error = ValueError("failure")
noted = ValueError("failure")
noted.add_note("first")
raised = ValueError("failure")


def shown(one):
    return len(getattr(one, "__notes__", []))


def chain(one):
    return f"{type(one.__cause__).__name__} {type(one.__context__).__name__} {one.__traceback__ is not None}"


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


@export
def chained(way):
    try:
        if way == "from":
            raise raised from KeyError("k")
        try:
            raise KeyError("k")
        except KeyError:
            raise raised
    except ValueError:
        pass
</script>

<p data-k="error">{shown(error)}</p>
<p data-k="noted">{shown(noted)}</p>
<p data-k="raised">{chain(raised)}</p>
