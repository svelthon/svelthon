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
    "classcall",
    "delegated",
    "delegated_class",
    "delegated_native",
    "delegated_instance",
    "delegated_twice",
    "doubling",
    "class_doubling",
    "doublers",
    "absolute",
    "rounding",
    "builtin_held",
    "bound_by_getter",
    "getter_nothing",
    "property_nothing",
    "resolutions",
    "mapped",
    "order",
    "listed",
    "tupled",
    "nested",
    "as_argument",
    "as_option",
    "as_listed",
    "made",
    "made_later",
    "made_inside",
    "made_twice",
    "shared_rows",
    "labelled",
    "holder",
    "stacked",
    "three",
    "spread",
    "arities",
    "changing",
    "replace_call",
    "call_from_python",
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


class ByClass:
    # `__call__` written as a class method: the descriptor again, under another
    # name, and its receiver is the class, taken out like `self`.
    @classmethod
    def __call__(cls):
        return VALUE


class ClassDoubling:
    @classmethod
    def __call__(cls, half):
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
classcall = ByClass()
class_doubling = ClassDoubling()


# A `__call__` that is itself bound elsewhere: a method of an instance, a method
# of a class, and a builtin bound to its value. Python calls each as it is, its
# own receiver already in it and the instance not handed to it.
class Delegated:
    __call__ = holder.run


class DelegatedClass:
    __call__ = Holder.built


class DelegatedNative:
    __call__ = VALUE.conjugate


delegated = Delegated()
delegated_class = DelegatedClass()
delegated_native = DelegatedNative()


# A `__call__` that is itself a callable instance, one level down and two:
# Python calls the inner one's `__call__`, its own instance bound.
class Inner:
    def __call__(self):
        return VALUE


class Outer:
    __call__ = Inner()


class Outermost:
    __call__ = Outer()


delegated_instance = Outer()
delegated_twice = Outermost()

# Its own container, since every value of `mapped` is the trivial callable the
# matrix loops over and this one takes an argument.
doublers = {"inner": doubling, "by_class": class_doubling}


# A static `__call__` that is a builtin, which has no signature to read.
class Absolute:
    __call__ = staticmethod(abs)


class Rounding:
    __call__ = staticmethod(round)


absolute = Absolute()
rounding = Rounding()
builtin_held = {"abs": absolute, "round": rounding}


# A `__call__` whose type has `__get__`: Python binds it and calls what `__get__`
# hands back, never the `__call__` of its own class.
class HalfGetter:
    def __get__(self, obj, owner=None):
        return lambda half: half * 2

    def __call__(self):
        return VALUE


class BoundByGetter:
    __call__ = HalfGetter()


bound_by_getter = BoundByGetter()


# And what `__get__` hands back takes nothing, by a descriptor of the author's
# and by a `property`: the caller's argument is trimmed to that. `__get__` is
# asked once per call.
resolved = 0


def nothing():
    return VALUE


class NothingGetter:
    def __get__(self, obj, owner=None):
        global resolved
        resolved += 1
        return nothing


class ByGetterNothing:
    __call__ = NothingGetter()


class ByPropertyNothing:
    @property
    def __call__(self):
        return nothing


getter_nothing = ByGetterNothing()
property_nothing = ByPropertyNothing()


def resolutions():
    return resolved

mapped = {
    "fn": fn,
    "bound": bound,
    "classbound": classbound,
    "staticfn": staticfn,
    "instance": instance,
    "inherited": inherited,
    "fixed": fixed,
    "classcall": classcall,
    "delegated": delegated,
    "delegated_class": delegated_class,
    "delegated_native": delegated_native,
    "delegated_instance": delegated_instance,
    "delegated_twice": delegated_twice,
}


# The same six in the other container a module publishes. The order is exported
# beside the list so the test reads the index from here rather than from a second
# copy of the list of shapes.
order = [
    "fn",
    "bound",
    "classbound",
    "staticfn",
    "instance",
    "inherited",
    "fixed",
    "classcall",
    "delegated",
    "delegated_class",
    "delegated_native",
    "delegated_instance",
    "delegated_twice",
]
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


class Changing:
    # A strategy whose call is replaced at run time, which is what a class
    # attribute is for. Python looks `__call__` up at every call, so the new body
    # is the one that runs — and the contract read once at the crossing was the
    # old one.
    def __call__(self):
        return VALUE


changing = Changing()


def replace_call():
    def taking(self, half):
        return half * 2

    Changing.__call__ = taking


def call_from_python(half):
    return changing(half)


def reads_its_own():
    # Python's side of the limit: the fields are untouched where they live.
    return [labelled.name, labelled.length]


def made(key):
    # A callable a function *returns*, which is the route an export does not
    # take: a factory, a builder, a strategy chosen at call time.
    return mapped[key]


async def made_later(key):
    return mapped[key]


def made_inside(key):
    return {"hook": mapped[key], "duration": 0.5}


def three(a, b, c):
    # What a library reads off `length` to learn a callback's arity.
    return a


def spread(*values):
    return len(values)


arities = [three, spread]


def shared_rows():
    # The control for the line above, in data: two references to one list come
    # back as one array, and that is the graph rule the callbacks had lost.
    rows = []

    return [rows, rows]


def made_twice(key):
    # One Python value, held twice: what comes back has to be one JavaScript
    # function twice, the way two references to one list come back as one array.
    one = mapped[key]

    return [one, one]


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
