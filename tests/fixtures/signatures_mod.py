__all__ = [
    "regular",
    "positional",
    "variadic",
    "defaulted",
    "decorated",
    "aliased",
    "as_object_decorated",
    "from_python",
    "rebind",
    "rebound",
]


def collect(fn):
    # A decorator that answers a function of a different signature, which is the
    # ordinary shape of one: the name keeps its spelling and stops holding what
    # the `def` declared.
    def wrapped(*values):
        return len(values)

    return wrapped


class Doubler:
    def __call__(self, value):
        return value * 2


def as_object(fn):
    # And one that answers something that is not a function at all. Python calls
    # it; a JavaScript call on it raises.
    return Doubler()


def regular(x, y):
    return x + y


def positional(x, /, y):
    return x + y


def variadic(*values):
    return len(values)


def defaulted(x, y=10):
    return x + y


@collect
def decorated(value):
    return value


# The same value under a second name, which is the road that always worked and
# the reference the export has to match.
aliased = decorated


@as_object
def as_object_decorated(value):
    return value


def from_python():
    # What Python itself does with the name, which is the other reference.
    return decorated(10, 20, 30)


def rebound(value):
    return value


def rebind():
    # A name that stops holding what its `def` declared, after the module has
    # been initialised and its exports built.
    global rebound

    def wider(*values):
        return len(values)

    rebound = wider
