# Names `__js__` brings that the module does not export: Python reads them live
# and writes none of them, as JavaScript writes no import.
__js__ = {"./js_reexport_source.js": ["counter", "bump", "reset"]}
__all__ = ["read", "read_global"]


def read():
    return counter


# A `global` that only reads the name binds nothing.
def read_global():
    global counter
    return counter
