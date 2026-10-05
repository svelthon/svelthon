# The same names from a store, which publishes what `__all__` lists.
__js__ = {"./js_reexport_source.js": ["counter", "bump"]}
__all__ = ["counter", "bump", "read"]


def read():
    return counter
