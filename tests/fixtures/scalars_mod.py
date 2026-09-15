"""The four doors a scalar enters Python by, asked the same question.

`format(x, ".2f")` is the question: arithmetic works on a raw JavaScript number
and hides the difference, while the format protocol does not.
"""

__js__ = {"./js_scalars.js": ["half", "getHalf", "big"]}
__all__ = ["as_constant", "as_result", "as_conversion", "as_literal", "as_big", "formatted"]


def as_constant():
    return format(half, ".2f")


def as_result():
    return format(getHalf(), ".2f")


def as_conversion():
    return format(to_py(half), ".2f")


def as_literal():
    return format(0.5, ".2f")


def as_big():
    return type(big).__name__


def formatted(x):
    return format(x, ".2f")
