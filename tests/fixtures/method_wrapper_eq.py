# A method-wrapper compares and hashes by its function and its receiver.
# `python3` on this module gives the lines the test expects.
__all__ = ["answers"]


class Box:
    pass


def answers():
    box = Box()
    return [
        repr(box.__setattr__ == box.__setattr__),
        repr(box.__setattr__ != box.__setattr__),
        repr(hash(box.__setattr__) == hash(box.__setattr__)),
        repr(box.__setattr__ == Box().__setattr__),
        repr((1).__add__ == (1).__add__),
    ]
