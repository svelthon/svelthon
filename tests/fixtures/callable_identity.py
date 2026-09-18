# Who a callable *is*, as a registry sees it.
#
# Each case builds its own class, so one case cannot answer for another through
# a cache that outlives it.
__js__ = {"./registry.js": ["on", "off", "size", "answers", "clear", "emit"]}
__all__ = [
    "removed_after_replacement",
    "removed_without_replacement",
    "both_shapes",
    "two_instances",
    "native_removed",
    "native_kept",
    "two_receivers",
    "two_operations",
    "python_method",
]


def replacement(self):
    return 2


def removed_after_replacement():
    class Strategy:
        def __call__(self):
            return 1

    handler = Strategy()

    clear()
    on(handler)

    # The class changes what the instance does; the instance is still the same
    # object, and the registry was given it.
    Strategy.__call__ = replacement

    gone = off(handler)

    return [gone, size()]


def removed_without_replacement():
    class Strategy:
        def __call__(self):
            return 1

    handler = Strategy()

    clear()
    on(handler)

    return [off(handler), size()]


def both_shapes(instance_first):
    class Fresh:
        def __call__(self):
            return 1

    handler = Fresh()

    clear()

    # Two Python values with two contracts: the bound method keeps the function
    # it was read from, the instance follows its class. In either order.
    if instance_first:
        on(handler)
        on(handler.__call__)
    else:
        on(handler.__call__)
        on(handler)

    Fresh.__call__ = replacement

    return [size(), sorted(answers())]


def two_instances():
    class Fresh:
        def __call__(self):
            return 1

    clear()
    on(Fresh())
    on(Fresh())

    return size()


# The third representation of a bound method in this engine: a builtin bound to
# a receiver, which Brython builds fresh on every read. `rows.append` is the one
# an author reaches for without thinking about it.


def native_removed():
    rows = []

    clear()
    on(rows.append)
    gone = off(rows.append)
    emit(9)

    # The count is half the answer; what the listener did is the other half.
    return [gone, size(), list(rows)]


def native_kept():
    # The witness that always worked: the method read once and held in a name.
    rows = []
    callback = rows.append

    clear()
    on(callback)
    gone = off(callback)
    emit(9)

    return [gone, size(), list(rows)]


def two_receivers():
    # Same operation, two lists. They must stay two callbacks, and an event must
    # reach each list once.
    first = []
    second = []

    clear()
    on(first.append)
    on(second.append)
    emit(9)

    return [size(), list(first), list(second)]


def two_operations():
    # Same list, two operations, which the receiver alone cannot tell apart.
    rows = []

    clear()
    on(rows.append)
    on(rows.clear)

    return size()


def python_method():
    # The control, an ordinary bound method: the shape that was already keyed by
    # receiver and function.
    class Box:
        def __init__(self):
            self.seen = []

        def take(self, value):
            self.seen.append(value)

    box = Box()

    clear()
    on(box.take)
    gone = off(box.take)
    emit(9)

    return [gone, size(), list(box.seen)]
