# Callables a JavaScript caller hands more arguments than they take.
__all__ = ["zero", "one", "bound", "instance", "by_property", "one_by_property", "variadic"]


def zero():
    return 42


def one(value):
    return value


class Holder:
    def run(self):
        return 42


class Callable:
    def __call__(self):
        return 42


bound = Holder().run
instance = Callable()


# A `__call__` that is a `property`: what it calls, and so what it takes, is
# known only once its getter answers, at the call.
class ByProperty:
    @property
    def __call__(self):
        return zero


class OneByProperty:
    @property
    def __call__(self):
        return one


by_property = ByProperty()
one_by_property = OneByProperty()


def variadic(*values):
    return len(values)
