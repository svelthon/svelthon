# A set crossing as its view, an empty one, and a function handing back what it
# is given, for the JavaScript functions they call: a callback, a set-like's
# `has` and `keys`, and an awaited object's `then`.
__all__ = ["values", "empty", "passing"]

values = {1, 2}
empty = set()


def passing(value):
    return value
