# Two spellings of a derived in a store, written past their declaration.
base = 1


@derived
def decorated():
    return base * 3


called = derived(lambda: base * 4)


def held():
    return f"{decorated} {called}"


def write(value):
    global decorated, called
    decorated = called = value


def bump():
    global base
    base += 1
