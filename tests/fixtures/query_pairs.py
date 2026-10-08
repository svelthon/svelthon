# Sequences of pairs whose class says what a loop yields, and a pair that does:
# `urllib.parse.urlencode` under `python3` gives the strings the test expects.
__all__ = ["selected", "empty", "rewritten", "grown", "refused"]


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


selected = Selected([("tag", "stale")])
empty = Empty([("tag", "stale")])
rewritten = [Pair(("tag", "stale"))]
grown = Selected([])
refused = Refuses([("tag", "stale")])
