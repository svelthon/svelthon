# Names `__js__` brings, listed in `__all__`: bound, so exported, and exported
# as the JavaScript binding they are.
__js__ = {"./js_reexport_source.js": ["counter", "bump", "reset"]}
__all__ = ["counter", "bump", "reset", "read", "overwrite"]


def read():
    return counter


def overwrite():
    globals()["counter"] = 7
