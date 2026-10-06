# A name first bound by `def`, then rebound by the module to a number, to
# another function, and deleted; and one a decorator first makes a number.
__all__ = ["action", "data", "scalar", "function_", "remove", "restore", "callable_data"]


def action():
    return 7


def as_number(fn):
    return 42


@as_number
def data():
    return 0


def scalar():
    global action
    action = 42


def function_():
    global action
    action = lambda: 9


def remove():
    global action
    del action


def restore():
    global action
    action = lambda: 7


def callable_data():
    global data
    data = lambda: 7
