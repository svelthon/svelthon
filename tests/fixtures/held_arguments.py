# Python containers handed to a JavaScript library that keeps them, by a named
# import and through `js`, then changed on either side.
__js__ = {"./held_arguments.js": ["keep", "push_to", "same"]}
__all__ = ["hand", "grow", "rows", "record", "twice", "snapshot"]

rows = [1]
record = {"count": 0}


def hand():
    keep("rows", rows)
    js.Object.assign(js.globalThis, {"heldRecord": record, "heldRows": rows})


def grow():
    rows.append(2)
    record["count"] = 1


def twice():
    return same(rows, rows)


# What an API that clones takes, as Svelte's `$state.snapshot` is.
def snapshot():
    keep("snapshot", to_js(rows))
