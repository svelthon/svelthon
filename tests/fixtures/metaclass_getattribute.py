# A metaclass's `__getattribute__`, called with the class and the name, and its
# AttributeError handed to `__getattr__` or to the default. `python3` on this
# module gives the lines the test expects.
__all__ = ["answers"]


class Meta(type):
    def __getattribute__(cls, name):
        if name == "hidden":
            raise AttributeError("custom message")
        return super().__getattribute__(name)


class WithFallback(Meta):
    def __getattr__(cls, name):
        return "fallback"


class Plain(metaclass=Meta):
    x = 1


class Fallback(metaclass=WithFallback):
    x = 1


# And a subscript, which finds its method along the class's MRO and never asks
# the metaclass, here one that hides all three.
class Hiding(type):
    def __getattribute__(cls, name):
        if name in ("__getitem__", "__setitem__", "__delitem__"):
            raise AttributeError(name)
        return super().__getattribute__(name)


class Store(metaclass=Hiding):
    def __init__(self):
        self.held = {}

    def __getitem__(self, key):
        return key

    def __setitem__(self, key, value):
        self.held[key] = value

    def __delitem__(self, key):
        del self.held[key]


# A metaclass's own `__getitem__`, which `Indexed[1]` and `Indexed[0:1]` call.
class MetaIndexed(type):
    def __getitem__(cls, key):
        return ("meta get", key)


class Indexed(metaclass=MetaIndexed):
    pass


def answers():
    try:
        Plain.hidden
        hidden = "no error"
    except AttributeError as error:
        hidden = str(error)
    store = Store()
    store["k"] = 1
    written = repr(store.held)
    del store["k"]
    return [
        repr(Plain.x),
        Plain.__name__,
        repr(getattr(Plain, "nothing", 0)),
        repr(hasattr(Plain, "hidden")),
        Fallback.hidden,
        repr(store[0:1]),
        written,
        repr(store.held),
        hidden,
        repr(Indexed[1]),
        repr(Indexed[0:1]),
    ]
