# What a server hands a page, through SvelteKit's transport (`transport.js`).
__all__ = [
    "values", "shared_complex", "load", "layout", "merge_layout", "merge_section", "merge_page", "walked", "pointed", "streamed", "streamed_point", "actions", "one", "two", "callables", "lossy", "unpicklable",
    "remote_lossy", "remote_batch", "remote_live", "remote_hook", "bumped", "kept", "stored", "STORE", "hooked", "Point",
    "Money", "describe", "data_of",
]

shared = [1]
one = {"list": shared}
two = {"list": shared}


class Point:
    def __init__(self, x):
        self.x = x

    def __repr__(self):
        return f"Point({self.x})"


class Money(complex):
    pass


class OwnPrice(float):
    def __getnewargs__(self):
        return (str(float(self)),)


class Tags(set):
    pass


class Blob(bytes):
    pass


class Rows(list):
    def __reduce__(self):
        return (Rows, (list(self),))


class Slotted:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


class Reduced:
    def __init__(self, x):
        self.x = x
        self.seen = "kept"

    def __reduce__(self):
        return (Reduced, (self.x,))


class Stated:
    def __init__(self):
        self.a = 1
        self.b = 2

    def __getstate__(self):
        return {"a": self.a}


class Oops(ValueError):
    pass


def oops():
    error = Oops("bad", 2)
    error.code = 404
    return error


class Single:
    def __init__(self):
        self.mark = "only"

    def __reduce__(self):
        return "SINGLE"


SINGLE = Single()


# One complex held in three places, and another of the same value.
def shared_complex():
    chosen = complex(1, -2)
    return {"selected": chosen, "samples": [chosen, complex(1, -2)], "again": chosen}


def values():
    one = [1]
    loop = [1]
    loop.append(loop)
    zipped = zip([1, 2, 3], "abc")
    next(zipped)
    return {
        "zipped": zipped,
        "tuple": (1, (2, 3)),
        "keys": {1: "a", None: "b"},
        "integral": 1.0,
        "negzero": -0.0,
        "set": {"b", "a", "c"},
        "shared": {"a": one, "b": one},
        "loop": loop,
        "point": Point(3),
        "bytes": b"ab",
        "complex": complex(1, -2),
        "money": Money(3, 4),
        "ownprice": OwnPrice(2.5),
        "tags": Tags(["b", "a"]),
        "blob": Blob(b"ab"),
        "rows": Rows([1, 2]),
        "box": {"__proto__": {"inherited": "unexpected"}, "safe": 3},
        "composite": {(True, None, 2.0): "t", complex(1, 2): "c", frozenset([1, 2]): "f", ((None,), 1): "n"},
        "slotted": Slotted(3, 6),
        "reduced": Reduced(4),
        "stated": Stated(),
        "oops": oops(),
        "cut": slice(1, None, 2),
        "dots": Ellipsis,
        "single": SINGLE,
        "dispatch": {int: "i", Point: "p", describe: "d", len: "l", Ellipsis: "e"},
    }


def load(event):
    return {"top": 1.0, "rows": (1, 2), "both": "page"}


def layout(event):
    return {"both": "layout", "first": 2.0}


# A layout's data and its page's, by kind: a page's value that reads in
# JavaScript as the layout's did, `1` over `1.0`; two keys JavaScript names
# alike, `1` and `"1"`, either way; and `1.0` and `1`, one key. And three
# nodes, a layout's, a nested layout's and the page's, writing keys equal in
# Python that JavaScript tells apart, `True` and `1`.
MERGED = {
    "typed": ({"amount": 1.0, "layer": "layout", "masthead": "m"}, {"amount": 1, "layer": "page", "page_field": "p"}),
    "int-str": ({1: "layout-int", "shared": "layout", "layout_field": "layout only"}, {"shared": "page", "1": "page-string", "page_field": "page only"}),
    "str-int": ({"1": "layout-string", "shared": "layout", "layout_field": "layout only"}, {"shared": "page", 1: "page-int", "page_field": "page only"}),
    "float-int": ({1.0: "layout"}, {1: "page"}),
    "float-other": ({"score": 2.0}, {"score": 1}),
    "bool-int-bool": ({True: "root"}, {1: "section"}, {True: "page"}),
    "int-bool-int": ({1: "root"}, {True: "section"}, {1: "page"}),
}


def merge_layout(event):
    return dict(MERGED[event.kind][0])


def merge_section(event):
    return dict(MERGED[event.kind][1])


def merge_page(event):
    return dict(MERGED[event.kind][-1])


def numbers():
    yield 1
    yield 2


def walked(event):
    zipped = zip([1, 2, 3], "abc")
    next(zipped)
    return {"zipped": zipped, "numbers": numbers()}


def pointed(event):
    point = Point(7)
    return {"item": point, "same": point, "pair": (point, 1), 2: [point]}


async def later():
    return 1.0


def streamed(event):
    return {"later": later()}


async def later_point():
    return Point(7)


def streamed_point(event):
    return {"later": later_point()}


def act(event):
    zipped = zip([1, 2, 3], "abc")
    next(zipped)
    return {"zipped": zipped}


def edited(event):
    return {"label": "from server", "pair": (1, 2), "other": 3}


def looped(event):
    answer = {"label": "from server"}
    answer["me"] = answer
    return answer


# An instance whose reduction loses what was changed after it was made: what
# the browser rebuilds says "kept", the original "changed".
def changed():
    reduced = Reduced(4)
    reduced.seen = "changed"
    return reduced


def lossy(event):
    return {"reduced": changed()}


def unpicklable(event):
    return {"hook": lambda: 1}


# A reduction that hands over another value at each pass: rebuilt once, it is
# Bumped(2), on the server's page and in the browser alike.
class Bumped:
    def __init__(self, n):
        self.n = n

    def __reduce__(self):
        return (Bumped, (self.n + 1,))


def bumped(event):
    return {"bumped": Bumped(1)}


# An instance whose own state holds a list its data holds too.
class Keeper:
    def __init__(self, items):
        self.items = items
        self.cache = "left out"

    def __getstate__(self):
        return {"items": self.items}


def kept(event):
    items = [1, 2, 3]
    return {"a": items, "g": Keeper(items)}


# Data no copy of could differ from, which the module keeps: its page reads the
# store itself.
STORE = {"rows": [Point(1), Point(2)]}


def stored(event):
    return STORE


# An instance its `__setstate__` fills as most do, through its `__dict__`.
class Loaded:
    def __init__(self, x):
        self.x = x

    def __setstate__(self, state):
        self.__dict__.update(state)
        self.loaded = True

    def __repr__(self):
        return f"Loaded({self.x}, {getattr(self, 'loaded', False)})"


def loaded(event):
    return {"value": Loaded(3)}


# And a dict its `__setitem__` fills, under a key it names anew.
class Upper(dict):
    def __setitem__(self, key, value):
        super().__setitem__(key.upper(), value)


def hooked():
    upper = Upper()
    upper["a"] = 1
    dict.__setitem__(upper, "b", 2)
    return {"loaded": Loaded(3), "upper": upper}


actions = {"default": act, "lossy": lossy, "loaded": loaded, "edited": edited, "looped": looped}


def remote_lossy():
    return {"reduced": changed()}


def remote_batch(args):
    return lambda arg, at: {"reduced": changed(), "arg": arg}


async def remote_live():
    yield {"reduced": changed()}


def remote_hook():
    return {"hook": lambda: 1}


class Gauge:
    def __init__(self, level):
        self.level = level

    def read(self):
        return self.level

    def __call__(self):
        return self.level + 1


def callables():
    gauge = Gauge(2)
    return {"function": describe, "klass": Gauge, "method": gauge.read, "called": gauge, "builtin": len}


def data_of(page):
    return describe(page.data)


def describe(x):
    if hasattr(x, "__next__"):
        return type(x).__name__ + ":" + repr(list(x))
    out = type(x).__name__ + ":" + repr(x)
    if isinstance(x, dict) and "a" in x and "b" in x:
        out += f" same={x['a'] is x['b']}"
    if isinstance(x, list) and len(x) > 1:
        out += f" cycle={x[1] is x}"
    return out
