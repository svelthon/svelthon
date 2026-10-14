# A dict keyed by "hasOwnProperty", a str key taken out of a dict with other
# keys, a key looked up after popitem, and a list subclass whose __iter__ yields
# other items, handed to list(), max(), dict() and bytes().
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Tens(list):
    def __iter__(self):
        return (x * 10 for x in list.__iter__(self))


def deleted():
    d = {"a": 1, 2: "x"}
    del d["a"]
    return d.get("a", "absent")


def after_popitem():
    d = {2: "x", 3: "y"}
    d.popitem()
    return 3 in d


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    return [answer(one) for one in [
        lambda: {"hasOwnProperty": 1}["hasOwnProperty"],
        deleted,
        after_popitem,
        lambda: list(Tens([1, 2])),
        lambda: max(Tens([1, 2])),
        lambda: dict([Tens([1, 2])]),
        lambda: bytes(Tens([1, 2])),
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
