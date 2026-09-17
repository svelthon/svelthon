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
    "fixed",
    "doubling",
    "doublers",
    "mapped",
    "order",
    "listed",
    "tupled",
    "nested",
    "as_argument",
    "as_option",
    "as_listed",
    "labelled",
    "holder",
    "stacked",
    "reads_its_own",
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


class Fixed:
    # `__call__` written as a static method. What the class dictionary holds is
    # the descriptor Brython builds, not a function, and it declares no receiver:
    # the two halves the boundary has to read are both different here.
    @staticmethod
    def __call__():
        return VALUE


class Doubling:
    # The same shape with a parameter, which is what says `self` is not silently
    # taken out of a signature that never had one.
    @staticmethod
    def __call__(half):
        return half * 2


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
fixed = Fixed()
doubling = Doubling()

# Its own container, since every value of `mapped` is the trivial callable the
# matrix loops over and this one takes an argument.
doublers = {"inner": doubling}

mapped = {
    "fn": fn,
    "bound": bound,
    "classbound": classbound,
    "staticfn": staticfn,
    "instance": instance,
    "inherited": inherited,
    "fixed": fixed,
}


# The same six in the other container a module publishes. The order is exported
# beside the list so the test reads the index from here rather than from a second
# copy of the list of shapes.
order = ["fn", "bound", "classbound", "staticfn", "instance", "inherited", "fixed"]
listed = [mapped[key] for key in order]
tupled = tuple(listed)

# And one level down on each side, which is where a registry really lives: the
# callables under a name, and a mapping a mapping holds.
nested = {"handlers": listed, "inner": mapped, "deep": [listed]}


class Labelled:
    # The two words a JavaScript function already owns, written as ordinary
    # Python attributes. `name` is about the commonest attribute there is.
    def __init__(self):
        self.name = "mine"
        self.length = 3

    def __call__(self):
        return VALUE


labelled = Labelled()

# The same object one level down, where the name used to be taken from the
# container rather than from the value.
holder = {"inner": labelled}

# And in a list, which is the other walk: the two carry the rule by different
# routes and a name taken from the container would be a different wrong word in
# each.
stacked = [labelled]


def reads_its_own():
    # Python's side of the limit: the fields are untouched where they live.
    return [labelled.name, labelled.length]


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
