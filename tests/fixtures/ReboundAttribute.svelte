<script lang="python">
# A list read through an attribute, replaced or deleted, and the old one
# changed: what the effect reads is the new list, or the fallback, and the old
# one is nobody's business. A module name is the witness.
kind: str = "class"
mode: str = "replace"
# A JavaScript array the test reads, so counting the runs writes no state the
# effect reads.
runs: object
rows = []
fallback = [7, 8]


class Shelf:
    rows = []


class Box:
    def __init__(self):
        self.rows = []


box = Box()


class Inherited:
    rows = []


heir = Inherited()


class Row(list):
    pass


row = Row()
row.rows = []


class Bag(dict):
    pass


bag = Bag()
bag.rows = []


class SlotBox:
    __slots__ = ("rows",)

    def __init__(self):
        self.rows = []


slotted = SlotBox()


def counter():
    pass


counter.rows = []


# A list only the author's code hands out, from a closure no name watches.
def answering():
    hidden = []

    class Asked:
        def __getattr__(self, name):
            return hidden

    class Described:
        @property
        def rows(self):
            return hidden

    return Asked(), Described()


asked, described = answering()


def holder():
    if kind == "getattr":
        return asked
    if kind == "property":
        return described
    if kind == "class":
        return Shelf
    if kind == "instance":
        return box
    if kind == "inherited":
        return heir
    if kind == "list subclass":
        return row
    if kind == "dict subclass":
        return bag
    if kind == "slot":
        return slotted
    return counter


def current():
    if kind == "module name":
        return rows
    if mode == "delete":
        return getattr(holder(), "rows", fallback)
    return holder().rows


old = current()


@effect
def observe():
    runs.push(len(current()))


@export
def detach():
    global rows
    if kind == "module name":
        rows = [1] if mode == "replace" else fallback
    elif kind == "inherited":
        if mode == "replace":
            Inherited.rows = [1]
        else:
            del Inherited.rows
    elif mode == "replace":
        holder().rows = [1]
    else:
        del holder().rows


@export
def change_old():
    old.append(9)


@export
def change_current():
    current().append(9)
</script>

<output>{len(current())}</output>
