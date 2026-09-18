# A business type derived from a scalar, meeting the helpers a template calls.
__all__ = ["says", "controls"]


class Stamp(float):
    pass


class Count(int):
    pass


def says():
    # Each helper with the subclass, in the order a template would reach them.
    return [date(Stamp(0.0)), fromnow(Stamp(0.0)), str(batch([1, 2, 3], Count(2)))]


def controls():
    # The exact types beside them, which were never in doubt.
    return [date(0.0), fromnow(0.0), str(batch([1, 2, 3], 2))]
