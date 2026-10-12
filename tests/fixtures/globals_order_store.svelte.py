# The order globals() lists a reactive module's names in, as `globals_order.py`.
__all__ = ["listed", "moved", "replaced"]
first = 1


def middle():
    return 0


last = 2


def listed():
    mapping = globals()
    views = (mapping, reversed(mapping), mapping.copy())
    return [[name for name in view if name in ("first", "middle", "last")] for view in views]


def moved():
    mapping = globals()
    mapping["first"] = mapping.pop("first")
    return listed()


def replaced():
    globals()["middle"] = 17
    return listed()
