<script lang="python">
# A list read through an attribute, replaced, and the old one changed: what the
# effect reads is the new list, and the old one is nobody's business. A module
# name is the witness.
kind: str = "class"
# A JavaScript array the test reads, so counting the runs writes no state the
# effect reads.
runs: object
rows = []


class Shelf:
    rows = []


class Box:
    def __init__(self):
        self.rows = []


box = Box()


def current():
    if kind == "class":
        return Shelf.rows
    if kind == "instance":
        return box.rows
    return rows


old = current()


@effect
def observe():
    runs.push(len(current()))


@export
def replace():
    global rows
    if kind == "class":
        Shelf.rows = [1]
    elif kind == "instance":
        box.rows = [1]
    else:
        rows = [1]


@export
def change_old():
    old.append(9)


@export
def change_current():
    current().append(9)
</script>

<output>{len(current())}</output>
