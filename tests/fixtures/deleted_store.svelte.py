# A store name Python deletes, and JavaScript assigns again.
count = 3


def drop_count():
    global count
    del count


def read_count():
    try:
        return str(count)
    except NameError:
        return "missing"


def has_count():
    return "count" in globals()
