<script lang="python">
# One slot written and deleted by four routes. The last two go through the
# member descriptor, which writes the storage without `$setattr`.
path: str = "assignment"


class Box:
    __slots__ = ("rows",)

    def __init__(self):
        self.rows = []


box = Box()
setter = Box.rows.__set__
deleter = Box.rows.__delete__


def replace():
    if path == "assignment":
        box.rows = [1]
    elif path == "builtin":
        object.__setattr__(box, "rows", [1])
    elif path == "descriptor":
        Box.rows.__set__(box, [1])
    else:
        setter(box, [1])


def erase():
    if path == "assignment":
        del box.rows
    elif path == "builtin":
        object.__delattr__(box, "rows")
    elif path == "descriptor":
        Box.rows.__delete__(box)
    else:
        deleter(box)


def grow():
    # Read without `$getattr`, so only the write can have handed the new list
    # the watch.
    object.__getattribute__(box, "rows").append(2)
</script>

<button data-k="replace" onclick={replace}>replace</button>
<button data-k="erase" onclick={erase}>erase</button>
<button data-k="grow" onclick={grow}>grow</button>
<p data-k="rows">{len(box.rows) if hasattr(box, "rows") else -1}</p>
