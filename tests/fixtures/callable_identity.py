# Who a callable *is*, as a registry sees it.
#
# Each case builds its own class, so one case cannot answer for another through
# a cache that outlives it.
__js__ = {"./registry.js": ["on", "off", "size", "answers", "clear"]}
__all__ = ["removed_after_replacement", "removed_without_replacement", "both_shapes", "two_instances"]


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
