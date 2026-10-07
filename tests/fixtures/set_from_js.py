# A set made from a JavaScript array this module is handed, and from a list
# subclass that says what it yields: `python3` gives these same answers for a
# list of floats.
__all__ = ["made"]


class Nine(list):
    def __iter__(self):
        return iter([9])


def made(values):
    updated = set()
    updated.update(values)
    return [
        0.5 in set(values),
        0.5 in frozenset(values),
        0.5 in updated,
        sorted(set(Nine([1, 2]))),
    ]
