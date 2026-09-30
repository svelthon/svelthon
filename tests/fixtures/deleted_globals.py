# `del` on a module's own global, in a plain `.py`.
count = 3


def drop():
    global count
    del count


def read():
    try:
        return str(count)
    except NameError:
        return "missing"


def restore():
    global count
    count = 4
