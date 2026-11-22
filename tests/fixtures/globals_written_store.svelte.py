# A store's name a function writes, and a name nothing ever binds.
future = 1


@derived
def doubled():
    return future * 2


def read():
    return future


def write(value):
    global future
    future = value


def absent():
    try:
        return missing
    except NameError as error:
        return str(error)
