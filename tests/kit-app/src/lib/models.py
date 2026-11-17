"""What a server hands a page, one value per case, and how Python reads it:
the same on the server and in the browser, which SvelteKit's transport carries
as pickle carries a value from one process to another."""

__all__ = ["CASES", "make", "describe", "Point", "Bag", "Row", "Price", "Money", "Lossy", "Guarded", "Bumped", "Loaded", "Upper"]


class Point:
    def __init__(self, x):
        self.x = x

    def __repr__(self):
        return f"Point({self.x})"


class Bag(dict):
    pass


class Row(list):
    pass


class Price(float):
    pass


class Money(complex):
    pass


# What its reduction hands over is its number alone: what changed after it was
# made is gone at the other end, and so on the server's page.
class Lossy:
    def __init__(self, x):
        self.x = x
        self.seen = "kept"

    def __reduce__(self):
        return (Lossy, (self.x,))

    def __repr__(self):
        return f"Lossy({self.x})"


# Its state leaves its token out.
class Guarded:
    def __init__(self, name):
        self.name = name
        self.token = "left out"

    def __getstate__(self):
        return {"name": self.name}

    def __repr__(self):
        return f"Guarded({self.name!r})"


# A reduction that hands over another value at each pass: rebuilt once, it is
# Bumped(2), on the server's page and in the browser alike.
class Bumped:
    def __init__(self, n):
        self.n = n

    def __reduce__(self):
        return (Bumped, (self.n + 1,))

    def __repr__(self):
        return f"Bumped({self.n})"


# Its `__setstate__` fills it as most do, through its `__dict__`, and adds an
# attribute: rebuilt at its first read in a template, that write was one Svelte
# refused, and a page with no engine read what the node held.
class Loaded:
    def __init__(self, x):
        self.x = x

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.loaded = True

    def __repr__(self):
        return f"Loaded({self.x}, {getattr(self, 'loaded', False)})"


# A dict its `__setitem__` fills, under a key it names anew.
class Upper(dict):
    def __setitem__(self, key, value):
        super().__setitem__(key.upper(), value)


CASES = [
    "tuple", "int_keys", "none_key", "set", "nested", "integral", "neg_zero", "big",
    "shared", "cycle", "instance", "bag", "row", "price", "astral", "bytes",
    "complex", "money", "lossy", "guarded", "bumped", "loaded", "upper",
]


def make(name):
    if name == "tuple":
        return (1, (2, 3))
    if name == "int_keys":
        return {1: "a", 2: "b"}
    if name == "none_key":
        return {None: 1, "k": 2}
    if name == "set":
        return {"b", "a", "c"}
    if name == "nested":
        return {"t": (1, (2, 3)), "s": [{"k": 1.0}]}
    if name == "integral":
        return 1.0
    if name == "neg_zero":
        return -0.0
    if name == "big":
        return 2 ** 60
    if name == "shared":
        one = [1]
        return {"a": one, "b": one}
    if name == "cycle":
        one = [1]
        one.append(one)
        return one
    if name == "instance":
        return Point(3)
    if name == "bag":
        bag = Bag(a=1)
        bag.note = "kept"
        return bag
    if name == "row":
        return Row([1, 2])
    if name == "price":
        price = Price(2.0)
        price.currency = "EUR"
        return price
    if name == "astral":
        return "𠀀"
    if name == "bytes":
        return b"ab"
    if name == "complex":
        return complex(1, -2)
    if name == "money":
        money = Money(3, 4)
        money.note = "kept"
        return money
    if name == "lossy":
        lossy = Lossy(4)
        lossy.seen = "changed"
        return lossy
    if name == "guarded":
        return Guarded("ada")
    if name == "bumped":
        return Bumped(1)
    if name == "loaded":
        return Loaded(3)
    if name == "upper":
        upper = Upper()
        upper["a"] = 1
        dict.__setitem__(upper, "b", 2)
        return upper
    return None


def describe(x):
    out = type(x).__name__ + ":" + repr(x)
    if isinstance(x, dict):
        out += " keys=" + ",".join(type(k).__name__ for k in x)
        if "a" in x and "b" in x:
            out += f" same={x['a'] is x['b']}"
    if isinstance(x, (list, tuple, set)):
        out += " items=" + ",".join(type(v).__name__ for v in x)
    if isinstance(x, list) and len(x) > 1 and x[1] is x:
        out += " cycle=True"
    if hasattr(x, "__dict__") and not isinstance(x, type):
        out += f" attrs={sorted(vars(x).items())}"
    return out
