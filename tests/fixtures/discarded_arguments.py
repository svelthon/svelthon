# Callables a JavaScript caller hands more arguments than they take.
__all__ = ["zero", "one", "bound", "instance", "variadic"]


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


def variadic(*values):
    return len(values)
