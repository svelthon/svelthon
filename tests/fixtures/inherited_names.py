# Names every JavaScript object has, which this module never binds, read at its
# top and in a function: `toString` names a class whose statement never runs,
# and `bound` is bound, to show a read finds what is there.
__all__ = ["at_top", "inside"]

bound = 1

if not bound:
    class toString:
        pass

at_top = []
try:
    constructor
    at_top.append("constructor")
except NameError:
    pass
try:
    toString
    at_top.append("toString")
except NameError:
    pass
try:
    valueOf
    at_top.append("valueOf")
except NameError:
    pass
try:
    bound
    at_top.append("bound")
except NameError:
    pass


def inside():
    found = []
    reads = [
        ("constructor", lambda: constructor),
        ("toString", lambda: toString),
        ("hasOwnProperty", lambda: hasOwnProperty),
        ("valueOf", lambda: valueOf),
        ("bound", lambda: bound),
    ]
    for name, read in reads:
        try:
            read()
            found.append(name)
        except NameError:
            pass
    return found
