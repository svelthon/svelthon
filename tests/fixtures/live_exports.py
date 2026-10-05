# Names a plain module exports and later binds again: a value, through its own
# functions, assigned with `+=` and with `=`, and a class.
__all__ = ["counter", "Shape", "Square", "bump", "reset", "swap", "read"]

counter = 0


class Shape:
    sides = 3


class Square:
    sides = 4


def bump():
    global counter
    counter += 1


def reset():
    global counter
    counter = 0


def swap():
    global Shape
    Shape = Square


def read():
    return counter
