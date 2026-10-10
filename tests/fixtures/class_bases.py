# Bases a class statement refuses, and the one it lays out on. `python3` on
# this module gives the lines the test expects.
__all__ = ["answers"]


class A:
    pass


def made(bases):
    try:
        return type("X", bases, {}).__base__.__name__
    except TypeError as error:
        return str(error)


def answers():
    return [made((A, A)), made((list, dict)), made((A, list))]
