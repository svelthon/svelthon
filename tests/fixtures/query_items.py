# Dicts whose class says what its items are. `urllib.parse.urlencode` and
# `json.dumps` under `python3` read them through `items()` and give what the
# test expects; a `keys` or an `__iter__` of their own is not what they ask.
__all__ = ["selected", "empty", "refusing", "keyed", "iterated", "spelled", "uneven", "listed", "copied", "returned"]


class Selected(dict):
    def items(self):
        return [("tag", "selected")]


class Empty(dict):
    def items(self):
        return []


class Refusing(dict):
    def items(self):
        raise ValueError("query items failed")


class Keyed(dict):
    def keys(self):
        return ["tag"]


class Iterated(dict):
    def __iter__(self):
        return iter(["tag"])


# A row `urlencode` unpacks and `json.dumps` refuses, and one neither takes.
class Spelled(dict):
    def items(self):
        return ["ab"]


class Uneven(dict):
    def items(self):
        return [("a", "b", "c")]


# Pairs written as lists: `dict(value.items())` and `urlencode` take them,
# `json.dumps` alone wants tuples.
class Listed(dict):
    def items(self):
        return [["tag", "selected"]]


def copied():
    return to_js(Listed({"tag": "selected"}))


def returned():
    return Listed({"tag": "selected"})


selected = Selected({"tag": "stale", "page": 2})
listed = Listed({"tag": "selected"})
empty = Empty({"tag": "stale", "page": 2})
refusing = Refusing({"tag": "stale", "page": 2})
keyed = Keyed({"tag": "stale", "page": 2})
iterated = Iterated({"tag": "stale", "page": 2})
spelled = Spelled({"tag": "stale"})
uneven = Uneven({"tag": "stale"})
