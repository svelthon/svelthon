# A module's `def` read by the module itself and written back to its own name.
__all__ = ["action", "same_again", "held"]


def action():
    return "first"


_original = action


def same_again():
    global action
    action = action


def held():
    return [action is _original, action.__name__, type(action).__name__]
