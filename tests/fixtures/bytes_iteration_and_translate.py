# A bytes iterator asked for its iterator, a bytearray iterator once its
# bytearray changed size, what translate() does with what its table gives, and
# maketrans() with an astral character. `python3` on this module gives the lines
# the test expects.
__all__ = ["answers"]


class Failing:
    def __getitem__(self, key):
        raise RuntimeError("table failure")


def bytes_rest():
    it = iter(b"abcd")
    next(it)
    return list(it)


def bytearray_rest():
    data = bytearray(b"abcd")
    it = iter(data)
    next(it)
    data.append(101)
    grown = list(it)
    data = bytearray(b"abcd")
    it = iter(data)
    next(it)
    data.clear()
    return grown, list(it)


def hints():
    seen = []
    for seq in ([1, 2, 3], (1, 2, 3), "ab😀", b"abc", range(3)):
        it = iter(seq)
        next(it)
        seen.append(it.__length_hint__())
    return seen


def restored():
    seen = []
    for seq in ([1, 2, 3, 4], (1, 2, 3, 4), "ab😀d", b"abcd"):
        it = iter(seq)
        it.__setstate__(2)
        seen.append(list(it))
    it = iter(range(1, 9, 2))
    next(it)
    it.__setstate__(1)
    seen.append(list(it))
    it = iter(range(2 ** 54))
    it.__setstate__(2 ** 53 + 1)
    seen.append([next(it)])
    return seen


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    return [answer(one) for one in [
        bytes_rest,
        bytearray_rest,
        lambda: "ab".translate(Failing()),
        lambda: "ab".translate({97: -1}),
        lambda: "abc".translate({97: 0x1F600, 98: True, 99: None}),
        lambda: "a😀b".translate(str.maketrans("a", "x", "😀")),
        lambda: str.maketrans({"😀": "x"}),
        hints,
        restored,
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
