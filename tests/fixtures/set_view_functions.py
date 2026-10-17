# Sets a module publishes, which cross as views: one per case, since each case
# writes on the one it reads.
__all__ = [
    "replaced", "own", "bind_null", "bind_other", "unchanged",
    "receiver", "getter", "locked", "frozen", "added", "fresh", "crossing",
]

# A JavaScript function that hands back what `valueOf()` gives of its argument.
__js__ = {"./set_view_tools.js": ["value_of"]}


def fresh():
    # A set of its own for each case that writes on it.
    return {1, 2}


class Tags(set):
    pass


def crossing():
    # Each kind of set handed to JavaScript and back through `valueOf()`: the
    # set itself, of its own class, and still holding what it held.
    answers = []

    for original in ({1, 2}, frozenset([1, 2]), Tags([1, 2])):
        back = value_of(original)
        answers.append([back is original, type(back).__name__, len(original)])

    return answers

replaced = {1, 2}
own = {1, 2}
bind_null = {1, 2}
bind_other = {1, 2}
unchanged = {1, 2}
receiver = {1, 2}
getter = {1, 2}
locked = {1, 2}
frozen = {1, 2}
added = {1, 2}
