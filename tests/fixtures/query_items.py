# Dicts whose class says what its items are. `urllib.parse.urlencode` and
# `json.dumps` under `python3` read them through `items()` and give what the
# test expects; a `keys` or an `__iter__` of their own is not what they ask.
__all__ = ["selected", "empty", "refusing", "keyed", "iterated", "spelled", "uneven", "listed", "copied", "returned", "filters", "guarded", "none_keyed", "none_paired"]

# A None key, beside the empty one: `urlencode` writes it `str(None)`.
none_keyed = {None: "missing", "": "blank", 0: "zero"}
none_paired = [(None, "missing"), ("", "blank"), (0, "zero")]


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


# A list that has `items()` as well: `urlencode` asks `items()` first, whatever
# the list holds, and walks none of it.
class Filters(list):
    def items(self):
        return [("scope", "mine"), ("tag", "summer"), ("tag", "green")]


class Guarded(Filters):
    def __iter__(self):
        raise ValueError("walked")


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
filters = Filters([("scope", "all")])
guarded = Guarded([("scope", "all")])
