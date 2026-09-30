# The reader is written before the function that deletes the global.
count = 3


def read_count():
    try:
        return str(count)
    except NameError:
        return "missing"


def drop_count():
    global count
    del count


def restore_count():
    global count
    count = 5
