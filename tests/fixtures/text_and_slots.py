# A loop over a str in a module, which runs strict; a str subclass iterated, and
# str(), repr() and a slice of a str holding astral or combining characters;
# what the setters of a builtin descriptor return; how __slots__ takes a str and
# a str subclass, and a slot written once its descriptor is gone. `python3` on
# this module gives the lines the test expects.
__all__ = ["answers"]


class Name(str):
    def __str__(self):
        return "wrong"


class Single(str):
    def __iter__(self):
        return iter(["other"])


def looped(value):
    seen = []
    for one in value:
        seen.append(one)
    return seen


def descriptors():
    A = type("A", (), {"__slots__": ("x",), "p": property(int, lambda *a: 5, lambda *a: 6)})
    a = A()
    returned = [(d.__set__(a, 1), d.__delete__(a)) for d in (A.x, A.p)]
    return [returned, type(A.x).__delete__.__name__]


def slots():
    declaration = Single("field")
    Box = type("Box", (), {"__slots__": declaration})
    Plain = type("Plain", (), {"__slots__": "field"})
    seen = [hasattr(Box, "field"), hasattr(Box, "other"), Box.__slots__ is declaration, Plain.__slots__]
    box = Box()
    del Box.field
    try:
        box.field = 1
        seen.append("written")
    except AttributeError:
        seen.append("refused")
    return seen


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    astral = "😀é"
    return [answer(one) for one in [
        lambda: looped(""),
        lambda: looped("ab"),
        lambda: list(Name("😀a")),
        lambda: looped(Name("ab")),
        lambda: str(astral) == astral,
        lambda: len(repr(astral)),
        lambda: "é".__str__() == "é",
        lambda: "😀a😀b"[::2],
        lambda: "😀a😀b"[::-1],
        descriptors,
        slots,
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
