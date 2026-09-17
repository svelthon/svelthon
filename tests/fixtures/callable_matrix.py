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
    "as_argument",
    "as_option",
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
    def __call__(self):
        return VALUE


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


def as_argument(key):
    keep(mapped[key])


def as_option(key):
    # A callback among data, which is the shape a library takes its options in.
    # The number beside it is the half that kept working while the callback did
    # not, and is what made the failure quiet.
    keep({"hook": mapped[key], "duration": 0.5})
