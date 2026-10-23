# Sequences of pairs whose class says what a loop yields, and a pair that does:
# `urllib.parse.urlencode` under `python3` gives the strings the test expects.
__all__ = ["selected", "empty", "rewritten", "grown", "refused", "walked", "ranged", "generated", "refusing"]


class Selected(list):
    def __iter__(self):
        yield ("tag", "selected")
        yield ("page", "2")


class Empty(list):
    def __iter__(self):
        return iter([])


class Pair(tuple):
    def __iter__(self):
        yield "tag"
        yield "selected"


class Refuses(list):
    def __iter__(self):
        raise ValueError("query iterator failed")


# Pairs that are no list or tuple, which Jinja's `|urlencode` walks as its loop
# unpacks them, where CPython's refuses a first row that is no tuple: an object
# of the author's, a range and a generator, and one whose walk refuses.
class Walked:
    def __iter__(self):
        return iter(["tag", "selected"])


class Refusing:
    def __iter__(self):
        raise ValueError("pair iterator failed")


def generated():
    return [(one for one in ("tag", "selected"))]


selected = Selected([("tag", "stale")])
walked = [Walked()]
ranged = [range(2)]
refusing = [Refusing()]
empty = Empty([("tag", "stale")])
rewritten = [Pair(("tag", "stale"))]
grown = Selected([])
refused = Refuses([("tag", "stale")])
