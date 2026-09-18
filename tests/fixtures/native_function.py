# A builtin, published under a name of the module's own, which is what a module
# does when it wants to hand a tool to its consumer.
__all__ = ["rounded", "shortened", "wrapped", "from_python"]

rounded = round
shortened = abs


def wrapped(value):
    # The witness: the same call written as a `def`, which has always worked
    # because the boundary reads its signature.
    return round(value, 1)


def from_python():
    # Python's side, untouched by any of this.
    return round(0.25, 1)
