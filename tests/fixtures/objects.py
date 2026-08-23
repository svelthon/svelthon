"""A plain module whose exports are Python objects, not dicts.

Everything here crosses the boundary through the export wrapper, which is what a
`load()`, an action or a `+server.py` handler goes through.
"""

__all__ = ["one", "nested", "looping", "empty", "mixed", "dumped", "indented", "plain"]


class Pep:
    def __init__(self, number, tags):
        self.number = number
        self.tags = tags

    @property
    def url(self):
        # A getter on the class, not a field on the instance. JavaScript would
        # not serialise this from a class instance either.
        return "/pep/" + str(self.number)


class Blank:
    pass


def one():
    return Pep(703, ["gil"])


def nested():
    return {"pep": Pep(750, ["strings"]), "rows": [Pep(1, []), Pep(20, [])]}


def looping():
    pep = Pep(8, [])
    pep.itself = pep
    return pep


def empty():
    return Blank()


def mixed():
    pep = Pep(484, ["typing"])
    return {"count": 2, "peps": [pep, pep], "none": None}


def dumped():
    # `to_json` is `to_js` with the dump attached: `json.dumps` would walk the
    # raw Brython object and never find the fields.
    return to_json(Pep(703, ["gil"]))


def indented():
    return to_json({"a": 1}, 2)


def plain():
    return to_json([1, "two", None, True])
