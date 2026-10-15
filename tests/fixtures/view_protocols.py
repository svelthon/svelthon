# Dicts and sets whose membership answers apart from their storage, as Python
# allows: `__contains__` decides `in`, and reading, writing, deleting and
# `discard` do not ask it.
__all__ = [
    "hiding",
    "raising",
    "counting",
    "asked",
    "member",
    "kept",
    "hidden",
    "hashed",
    "python_answers",
    "adding",
    "grown",
    "stayer",
    "elsewhere",
    "twin",
    "twin_key",
    "shrunk",
    "remover",
    "arm",
    "before",
    "present",
    "loud_hash",
    "hashing",
    "loud_equal",
    "equalling",
    "shout",
    "python_raises",
    "counted",
    "others",
    "compared",
    "python_compares",
    "nested_key",
    "nesting",
    "nested_hashes",
    "python_nested",
    "shy",
    "shying",
    "python_shy",
    "own_bag",
    "reading",
    "python_dispatch",
    "numbers",
    "prices",
    "texts",
    "python_scalars",
]

calls = []
hashes = []
comparisons = []
nested = []
armed = False
loud = False
shy_target = None


class Hiding(dict):
    def __contains__(self, key):
        return False


class Raising(dict):
    def __contains__(self, key):
        raise ValueError("no membership")


class Counting(dict):
    def __contains__(self, key):
        calls.append(key)
        return dict.__contains__(self, key)


class Member:
    def __hash__(self):
        hashes.append(1)
        return 7


class HidingSet(set):
    def __contains__(self, one):
        return False


# A member whose hash, once armed, adds 99 to the set it sits in.
class Adding:
    def __hash__(self):
        if armed:
            grown.add(99)
        return 41


class Plain:
    pass


# A set whose `discard` removes 99, and keeps the member it is asked for.
class Elsewhere(set):
    def discard(self, one):
        set.discard(self, 99)


# A key equal to another made with the same value.
class Key:
    def __init__(self, value):
        self.value = value

    def __eq__(self, other):
        return isinstance(other, Key) and other.value == self.value

    def __hash__(self):
        return self.value


# A key its set does not hold, whose hash, once armed, takes 99 out of it.
class Removing:
    def __hash__(self):
        if armed:
            shrunk.discard(99)
        return 42


# Keys that raise, once loud, a `KeyError` naming the key asked for, as a
# lookup that finds nothing names it: by their hash, and by their equality
# with another key filed under the same hash.
class LoudHash:
    def __hash__(self):
        if loud:
            raise KeyError(self)
        return 43


class LoudEqual:
    def __hash__(self):
        return 44

    def __eq__(self, other):
        if loud:
            raise KeyError(loud_equal)
        return self is other


# A key that counts the times it is compared.
class Counted:
    def __hash__(self):
        return 45

    def __eq__(self, other):
        comparisons.append(1)
        return self is other


# A key whose equality hashes both keys it compares, each hash counted.
class Nested:
    def __hash__(self):
        nested.append(1)
        return 46

    def __eq__(self, other):
        hash(self)
        hash(other)
        return True


# A key equal to nothing, whose equality takes 99 out of the set it is looked
# up in.
class Shy:
    def __hash__(self):
        return 47

    def __eq__(self, other):
        shy_target.discard(99)
        return False


def make_shy():
    global shy_target
    shy_target = {Shy(), 99}
    return shy_target


# A set whose `discard` its object holds, and one whose `__getattribute__`
# hands one out, each removing 99 whatever it is asked for.
class Bag(set):
    pass


def make_own_bag():
    bag = Bag([1, 99])

    def own_discard(one):
        set.discard(bag, 99)

    bag.discard = own_discard
    return bag


class Reading(set):
    def __getattribute__(self, name):
        if name == "discard":
            return lambda one: set.discard(self, 99)
        return set.__getattribute__(self, name)


# Members of a subclass of a number or of a string, crossing as the scalar, in
# sets whose `discard` hands on to the set's own.
class Number(int):
    pass


class Price(float):
    pass


class Text(str):
    pass


class Delegate(set):
    def discard(self, one):
        set.discard(self, one)


hiding = Hiding(x=7)
raising = Raising(x=7)
counting = Counting(x=7)
member = Member()
kept = {member}
hidden = HidingSet([1, 2])
adding = Adding()
grown = {adding}
stayer = Plain()
elsewhere = Elsewhere([stayer, 99])
twin = Elsewhere([Key(41), 99])
twin_key = Key(41)
shrunk = {Key(41), 99}
remover = Removing()
loud_hash = LoudHash()
hashing = {loud_hash}
loud_equal = LoudEqual()
equalling = {LoudEqual()}
counted = Counted()
others = Elsewhere([counted, 99])
nested_key = Nested()
nesting = {Nested()}
shy = Shy()
shying = make_shy()
own_bag = make_own_bag()
reading = Reading([1, 99])
numbers = Delegate([Number(7)])
prices = Delegate([Price(0.5)])
texts = Delegate([Text("hello")])


def arm():
    global armed
    armed = True


# Python's own answer, the witness: whether each member is held, before the
# deletions and after them.
def held():
    return [adding in grown, stayer in elsewhere, twin_key in twin, remover in shrunk]


before = held()


def present():
    global armed
    armed = False
    return held()


def asked():
    return len(calls)


def hashed():
    return len(hashes)


def compared():
    return len(comparisons)


def shout(on):
    global loud
    loud = on


# The witness: what Python's `discard` raises for each loud key.
def python_raises():
    shout(True)
    raised = []
    for held_set, key in ((hashing, loud_hash), (equalling, loud_equal)):
        try:
            held_set.discard(key)
            raised.append(None)
        except KeyError:
            raised.append("KeyError")
    shout(False)
    return raised


# The witness: how many comparisons Python's `discard` makes on a set like
# `others`.
def python_compares():
    one = Counted()
    start = compared()
    Elsewhere([one, 99]).discard(one)
    return compared() - start


def nested_hashes():
    return len(nested)


# The witness: how many hashes Python's `discard` runs on a set like `nesting`.
def python_nested():
    held_set = {Nested()}
    start = nested_hashes()
    held_set.discard(Nested())
    return nested_hashes() - start


# The witness: what a set like `shying` holds after Python's `discard`.
def python_shy():
    held_set = make_shy()
    held_set.discard(Shy())
    return len(held_set)


# The witness: what sets like `own_bag` and `reading` hold after Python's
# `discard(1)`.
def python_dispatch():
    held = [make_own_bag(), Reading([1, 99])]
    for held_set in held:
        held_set.discard(1)
    return [sorted(held_set) for held_set in held]


# The witness: whether each scalar was held, and is no longer, after Python's
# `discard` of it.
def python_scalars():
    went = []
    for held_set, one in ((Delegate([Number(7)]), 7), (Delegate([Price(0.5)]), 0.5), (Delegate([Text("hello")]), "hello")):
        before = one in held_set
        held_set.discard(one)
        went.append(before and one not in held_set)
    return went


# The witness: the same operations written in Python.
def python_answers():
    bag = Hiding(x=7)
    read = bag["x"]
    member_in = "x" in bag
    del bag["x"]
    loud = Raising(x=7)
    loud["y"] = 8
    del loud["x"]
    gone = HidingSet([1, 2])
    gone.discard(1)
    return [read, member_in, len(bag), sorted(dict.keys(loud)), len(gone)]
