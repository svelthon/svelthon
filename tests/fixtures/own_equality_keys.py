# Tuples whose class says what equality is: one by identity, one that finds all
# its values equal, and one that only prints its own way and keeps the tuple's.
__all__ = ["distinct", "joined", "spelled", "nested", "exact"]


class Distinct(tuple):
    def __eq__(self, other):
        return self is other

    def __hash__(self):
        return id(self)


class Joined(tuple):
    def __eq__(self, other):
        return isinstance(other, Joined)

    def __hash__(self):
        return 0


class Spelled(tuple):
    def __repr__(self):
        return "spelled"


# And a float that is equal to itself alone.
class Exact(float):
    def __eq__(self, other):
        return self is other

    def __hash__(self):
        return id(self)


distinct = [Distinct((1,)), Distinct((1,))]
exact = [Exact(0.5), Exact(0.5)]
joined = [Joined((1,)), Joined((2,))]
spelled = [Spelled((1,)), Spelled((1,))]
nested = [(distinct[0], 2), (distinct[1], 2), (distinct[0], 2)]
