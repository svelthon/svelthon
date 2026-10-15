# A class whose attribute its instance reads, and a function that changes it on
# the class, for a page written in JavaScript alone.
__all__ = ["tally", "relabel"]


class Tally:
    label = "first"


tally = Tally()


def relabel():
    Tally.label = "second"
