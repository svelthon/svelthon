# A str subclass given to a str method, as receiver or argument; positions and
# lengths around an astral character; center()'s odd fill char; float() of a
# str subclass; print() of astral text; and what a class does at its creation
# with __class_getitem__, __dict__, __set_name__ and its methods' __qualname__.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Name(str):
    def __str__(self):
        return "wrong"


class Static:
    @staticmethod
    def __class_getitem__(key):
        return key


class Keyed:
    def __class_getitem__(cls, key):
        return key


class Public:
    @property
    def __dict__(self):
        return {"public": 1}


def set_names():
    seen = []

    class Descriptor:
        def __set_name__(self, owner, name):
            seen.append(name)

    type("Box", (), {"__doc__": Descriptor(), "x": Descriptor()})
    return seen


def free(self):
    pass


def local_method():
    class Box:
        def f(self):
            pass
    return Box.f.__qualname__, type("Made", (), {"free": free}).free.__qualname__


def printed():
    print("😀a")
    return "printed"


def answer(question):
    try:
        return repr(question())
    except Exception as error:
        return type(error).__name__


def answers():
    s = Name(" ab b ")
    return [answer(one) for one in [
        lambda: ["-".join([Name("a"), Name("b")]), s.lstrip(), s.startswith(" a"), " ab".find(Name("b")), Name("ab").encode()],
        lambda: ["😀a|b".partition("|"), "😀a\r\nb".splitlines(), format("😀a", ">4"), "a😀".endswith("😀")],
        lambda: [len(x) for x in ("".join(["😀", "a"]), "😀a".upper(), (" 😀a ").strip(), "😀a".ljust(4), "😀a" * 2)],
        lambda: ["ab".center(5, "*"), "😀".center(3, "*")],
        lambda: float(Name(" 1.5 ")),
        printed,
        lambda: [Keyed[3], Static.__class_getitem__(3), list[int].__args__],
        lambda: [Public().__dict__, set_names(), local_method()],
    ]]


if __name__ == "__main__":
    for line in answers():
        print(line)
