# A reactive module: a class whose metaclass is the author's, read by a
# function of the module for its length, and the function that gives the
# metaclass a new `__len__`.
__all__ = ["size", "change_owned"]


class OwnMeta(type):
    def __len__(cls):
        return 1


class Owned(metaclass=OwnMeta):
    pass


def size():
    return len(Owned)


def replacement(cls):
    return 99


def change_owned():
    OwnMeta.__len__ = replacement
