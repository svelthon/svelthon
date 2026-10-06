# A reactive module calls itself by the name `import` finds it by.
__all__ = ["report"]


class Kept:
    pass


def report():
    return [__name__, report.__module__, Kept.__module__]
