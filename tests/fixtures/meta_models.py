# A class whose metaclass is the author's, which a component imports, and the
# function that gives the metaclass a new `__len__`.
__all__ = ["Subject", "change_subject"]


class Meta(type):
    def __len__(cls):
        return 1


class Subject(metaclass=Meta):
    pass


def replacement(cls):
    return 99


def change_subject():
    Meta.__len__ = replacement
