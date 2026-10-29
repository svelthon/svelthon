# A store function JavaScript keeps, whose name the module binds to another
# function, then deletes.
def action():
    return "first"


def replacement():
    return "second"


also = action


def rebind():
    global action
    action = replacement


def remove():
    global action
    del action
