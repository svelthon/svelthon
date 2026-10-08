# A set made from a JavaScript array this module is handed, from a list or a
# dict subclass that says what it yields, and asked whether it is inside a
# dict: `python3` gives these same answers for a list of floats.
__all__ = ["made"]


class Nine(list):
    def __iter__(self):
        return iter([9])


class Filtered(dict):
    def __iter__(self):
        return iter([key for key in dict.__iter__(self) if key != 2])


def made(values):
    updated = set()
    updated.update(values)
    return [
        0.5 in set(values),
        0.5 in frozenset(values),
        0.5 in updated,
        sorted(set(Nine([1, 2]))),
        sorted(set(Filtered({1: 10, 2: 20}))),
        sorted({1, 2, 3}.intersection(Filtered({1: 10, 2: 20}))),
        {2}.issubset({2: 0}),
    ]
