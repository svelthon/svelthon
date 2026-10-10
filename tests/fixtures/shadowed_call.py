# A set crossing as its view, an empty one, and a function handing back what it
# is given, for the JavaScript functions they call: a callback, a set-like's
# `has` and `keys`, and an awaited object's `then`; and a new set per call, for
# the members JavaScript puts on its view.
__all__ = ["values", "empty", "passing", "fresh"]

values = {1, 2}
empty = set()


def fresh():
    return {1, 2}


def passing(value):
    return value
