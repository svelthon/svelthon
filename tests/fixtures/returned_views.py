# Containers a function hands back to JavaScript, which cross as an exported
# container does: as their view.
__all__ = ["rows", "grow", "read", "tags"]

held = [1, 2]


def rows():
    return held


def grow():
    held.append(3)


def read():
    return repr(held)


def tags():
    return {1, 2}
