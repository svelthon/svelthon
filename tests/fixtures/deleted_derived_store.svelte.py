# A store whose derived the module can delete, and bind again.
base = 7


@derived
def value():
    return base * 2


def drop():
    global value
    del value


def rebind():
    global value
    value = 5
