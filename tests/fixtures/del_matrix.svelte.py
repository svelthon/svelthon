# The kinds of name a store publishes, deleted and bound again.
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
    "state": lambda: state,
    "helper": lambda: helper(),
    "twice": lambda: twice,
}


def seen(name):
    return f"{outcome(READERS[name])} {name in globals()}"


def drop(name):
    global state, helper, twice
    if name == "state":
        del state
    elif name == "helper":
        del helper
    elif name == "twice":
        del twice


def rebind(name):
    global state, helper, twice
    if name == "state":
        state = 7
    elif name == "helper":
        helper = lambda: 7
    elif name == "twice":
        twice = lambda: 7
