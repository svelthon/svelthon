# One trivial callable, written every way Python writes one, handed over by
# every route a boundary has.
#
# The body is the same everywhere and says two things at once: it declares no
# parameter, so a caller that hands it an event measures the trim, and it
# answers a float, so the same call measures what crosses back.
__js__ = {"./matrix_library.js": ["keep"]}
__all__ = [
    "fn",
    "bound",
    "classbound",
    "staticfn",
    "instance",
    "inherited",
    "mapped",
    "order",
    "listed",
    "tupled",
    "nested",
    "as_argument",
    "as_option",
    "as_listed",
]

VALUE = 0.25


def fn():
    return VALUE


class Holder:
    def run(self):
        return VALUE

    @classmethod
    def built(cls):
        return VALUE

    @staticmethod
    def made():
        return VALUE


class Strategy:
    # An object with state and a `__call__`, which is how a configured callback
    # is written when a closure is not enough.
    #
    # The answer is computed *from the field* on purpose: a wrapper carries no
    # attributes, so the only thing that proves the state is still reachable is
    # that the call reads it.
    def __init__(self):
        self.factor = 4

    def __call__(self):
        return self.factor / 16


class Derived(Strategy):
    # The same object with its `__call__` one class up. Nothing else about it
    # differs, which is what makes it the witness.
    pass


holder = Holder()

# A method of an instance, a method of the class, a function of the class, and
# the two instances. `fn` above is the sixth, and the only one a module can
# publish with a `def`.
bound = holder.run
classbound = Holder.built
staticfn = Holder.made
instance = Strategy()
inherited = Derived()

mapped = {
    "fn": fn,
    "bound": bound,
    "classbound": classbound,
    "staticfn": staticfn,
    "instance": instance,
    "inherited": inherited,
}


# The same six in the other container a module publishes. The order is exported
# beside the list so the test reads the index from here rather than from a second
# copy of the list of shapes.
order = ["fn", "bound", "classbound", "staticfn", "instance", "inherited"]
listed = [mapped[key] for key in order]
tupled = tuple(listed)

# And one level down on each side, which is where a registry really lives: the
# callables under a name, and a mapping a mapping holds.
nested = {"handlers": listed, "inner": mapped, "deep": [listed]}


def as_argument(key):
    keep(mapped[key])


def as_listed(key):
    # A callback inside a list handed to a JavaScript function, which is the
    # argument side of the same question.
    keep([mapped[key], 0.5])


def as_option(key):
    # A callback among data, which is the shape a library takes its options in.
    # The number beside it is the half that kept working while the callback did
    # not, and is what made the failure quiet.
    keep({"hook": mapped[key], "duration": 0.5})
