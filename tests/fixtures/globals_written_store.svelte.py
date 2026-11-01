# A store's name only `globals()` binds, and a name nothing ever binds.
globals()["future"] = 1


@derived
def doubled():
    return future * 2


def read():
    return future


def write(value):
    globals()["future"] = value


def absent():
    try:
        return missing
    except NameError as error:
        return str(error)
