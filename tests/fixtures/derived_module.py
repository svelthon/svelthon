# A plain module's derived value, read by Python at every read.
counter = 0


@derived
def total():
    return counter * 2


def bump():
    global counter
    counter += 1


def read():
    return total
