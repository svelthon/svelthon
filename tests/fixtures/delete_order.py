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


# The same, bound inside a block of the module rather than at its top level.
if True:
    level = 1

    def read_level():
        try:
            return str(level)
        except NameError:
            return "missing"

    def drop_level():
        global level
        del level
