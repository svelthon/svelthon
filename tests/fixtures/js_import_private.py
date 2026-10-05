# Names `__js__` brings that the module does not export: Python reads them live
# and writes none of them, as JavaScript writes no import.
__js__ = {"./js_reexport_source.js": ["counter", "bump", "reset"]}
__all__ = ["read", "read_global", "by_item", "by_update", "by_pop", "by_delete"]


def read():
    return counter


# A `global` that only reads the name binds nothing.
def read_global():
    global counter
    return counter


def by_item():
    globals()["counter"] = 7


def by_update():
    globals().update(counter=8)


def by_pop():
    globals().pop("counter")


def by_delete():
    del globals()["counter"]
