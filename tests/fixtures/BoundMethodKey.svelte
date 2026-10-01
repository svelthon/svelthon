<script lang="python">
# A bound method is read anew each time, and two are equal when they bind the
# same object to the same function: the same one again keeps the block, one on
# another object makes a new one. Alone, in a tuple, and a builtin's.
kind: str = "alone"


class Row:
    def act(self):
        return 1


row = Row()
other = Row()
rows = []
others = []


def make(target):
    if kind == "builtin":
        return ((rows if target is row else others).append,)
    method = target.act
    return method if kind == "alone" else (method,)


key = make(row)


@export
def equal_again():
    return key == make(row)


@export
def reread():
    global key
    key = make(row)


@export
def change():
    global key
    key = make(other)
</script>

{#key key}<input value="draft" />{/key}
