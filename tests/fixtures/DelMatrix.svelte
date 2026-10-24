<script lang="python">
# Every kind of name a component publishes, deleted and bound again. Each row
# holds one contract: once deleted, a read raises NameError and the name is
# not in globals(), whatever its getter converts or computes; a write brings
# it back.
count: int = 1
level: float = 0.5
rows: list = bindable([])
state = 3


def helper():
    return "h"


@derived
def twice():
    return state * 2


def outcome(read):
    try:
        return str(read())
    except NameError:
        return "NameError"


READERS = {
    "count": lambda: count,
    "level": lambda: level,
    "rows": lambda: rows,
    "state": lambda: state,
    "helper": lambda: helper(),
    "twice": lambda: twice,
}


@export
def seen(name):
    return f"{outcome(READERS[name])} {name in globals()}"


@export
def drop(name):
    global count, level, rows, state, helper, twice
    if name == "count":
        del count
    elif name == "level":
        del level
    elif name == "rows":
        del rows
    elif name == "state":
        del state
    elif name == "helper":
        del helper
    elif name == "twice":
        del twice


@export
def rebind(name):
    global count, level, rows, state, helper, twice
    if name == "count":
        count = 7
    elif name == "level":
        level = 7
    elif name == "rows":
        rows = [7]
    elif name == "state":
        state = 7
    elif name == "helper":
        helper = lambda: 7
    elif name == "twice":
        twice = 7


@export
def rebind_by_loop(name):
    global state
    for state in [8]:
        pass
</script>

<p>matrix</p>
