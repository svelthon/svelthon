# A __getitem__ iterator asked for its iterator and once exhausted, a
# __getitem__ defined as a staticmethod or a callable instance, the start of
# enumerate, a subclass of a builtin iterator, zip() with nothing to zip, and
# the bounds of a str or bytes search.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Sequence:
    def __init__(self):
        self.data = [1, 2, 3]

    def __getitem__(self, index):
        return self.data[index]


class Static:
    @staticmethod
    def __getitem__(index):
        return [1, 2][index]


class Calls:
    def __call__(self, *args):
        return len(args)


class CallableItem:
    __getitem__ = Calls()


class Seven:
    def __index__(self):
        return 7


class Labelled(filter):
    label = "derived"


def sequence_rest():
    seq = Sequence()
    it = iter(seq)
    next(it)
    rest = list(iter(it))
    seq.data.append(4)
    return rest, next(it, "stop")


def labelled():
    obj = Labelled(None, [0, 1, 2])
    obj.seen = True
    return type(obj).__name__, obj.label, obj.seen, list(obj)


def searches():
    return ("abc".find("b", 0, 1), "abc".find("", 4), "abc".rfind("b", 1),
            "abc".startswith("", 4), "abc".endswith("", 4), "a😀b".count(""),
            "a😀b".count("", 3))


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    return [answer(one) for one in [
        sequence_rest,
        lambda: (Static()[1], list(Static())),
        lambda: CallableItem()[0],
        lambda: list(enumerate("ab", Seven())),
        lambda: list(enumerate("ab", 2 ** 53 + 1)),
        lambda: list(enumerate("ab", 1.5)),
        labelled,
        lambda: list(zip()),
        searches,
        lambda: (b"aaa".count(b"a", 2), b"abcab".index(b"b", 2), b"abc".find(b"", 4),
                 bytearray(b"abc").startswith(b"", 4), b"aaa".count(b"aa")),
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
