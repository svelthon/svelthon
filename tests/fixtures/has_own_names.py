# Names spelled like the methods and properties of JavaScript objects: a
# variable, an argument, a class pattern keyword, and keywords unpacked into a
# builtin. Each answer is what CPython answers.
__all__ = ["answers"]


def local_names():
    hasOwnProperty = 1
    x = 1
    x = 2
    try:
        unbound
    except UnboundLocalError:
        x += 10
    unbound = 3
    return x


def deleted_unbound():
    hasOwnProperty = 1
    if not hasOwnProperty:
        y = 1
    try:
        del y
    except NameError as error:
        return type(error).__name__


def parameter(hasOwnProperty, x=5):
    return x


class HasOwnPattern:
    __match_args__ = ("x",)

    def __init__(self):
        self.x = 1


def pattern():
    match HasOwnPattern():
        case HasOwnPattern(1, hasOwnProperty=2):
            return "hasOwnProperty"
        case HasOwnPattern(1):
            return "x"


class InheritedNames:
    def keys(self):
        return ["valueOf"]

    def __getitem__(self, key):
        return 3


def refused(call):
    try:
        call()
    except TypeError:
        return "TypeError"
    return "accepted"


# Each answer on its own, an error told by its class.
def safely(call):
    try:
        return call()
    except Exception as error:
        return type(error).__name__


def answers():
    return [
        safely(lambda: repr(local_names())),
        safely(lambda: repr(deleted_unbound())),
        safely(lambda: repr(parameter(1))),
        safely(lambda: refused(lambda: "a b".split(hasOwnProperty=1))),
        safely(lambda: repr(pattern())),
        safely(lambda: repr("{x}".format(**{"constructor": 2}, x=1))),
        safely(lambda: repr("{x}".format(**InheritedNames(), x=1))),
    ]
