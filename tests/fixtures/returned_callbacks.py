# A Python callable handed to JavaScript and handed straight back: the very
# callable, by both routes, and the one a set holds.
__all__ = ["returned"]
__js__ = {"./returned_library.js": ["identity", "holder"]}


def plain():
    return 7


class Callable:
    def __call__(self):
        return 7


def returned():
    rows = []
    for callback in (plain, Callable()):
        for back in (identity(callback), holder.identity(callback)):
            rows.append([back is callback, back in {callback}, back()])
    return rows
