# The same rebindings in a reactive module, read through its named exports.
__all__ = ["action", "scalar", "remove", "restore"]


def action():
    return 7


def scalar():
    global action
    action = 42


def remove():
    global action
    del action


def restore():
    global action
    action = lambda: 7
