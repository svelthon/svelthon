# Subclasses of set whose `__iter__` says what a walk yields, or is wrong about
# it and the script says so, and two that leave iteration alone.
__js__ = {"./iterated_sets_walk.js": ["spread", "each", "put"]}
__all__ = ["SETS", "walked", "caught"]


class Filtered(set):
    # A walk yields one member of three.
    def __iter__(self):
        return iter([3])


class Ordered(set):
    # A generator function is an `__iter__` too.
    def __iter__(self):
        yield from sorted(set.__iter__(self), reverse=True)


class Refuses(set):
    def __iter__(self):
        raise ValueError("not today")


class Plain(set):
    # A list is iterable, and it is not an iterator. `iter()` refuses this.
    def __iter__(self):
        return [1, 2, 3]


class Named(set):
    # Adds a name and leaves iteration alone.
    tag = "named"


SETS = {
    "filtered": Filtered([1, 2, 3]),
    "ordered": Ordered([1, 2, 3]),
    "refuses": Refuses([1, 2, 3]),
    "plain": Plain([1, 2, 3]),
    "named": Named([1, 2, 3]),
    "frozen": frozenset([1, 2, 3]),
}


def walked(name):
    # What Python does with the same object, the reference JavaScript has to
    # match, the refusals included.
    try:
        return [x for x in SETS[name]]
    except Exception as error:
        return f"{type(error).__name__}: {error}"


class RefusesList(list):
    def __iter__(self):
        raise ValueError("not today")


def caught():
    # What this module catches of an error raised in Python while JavaScript
    # walks, or writes into, a value this module handed it.
    out = []
    for call, args in [
        (spread, [SETS["refuses"]]),
        (each, [SETS["refuses"]]),
        (spread, [RefusesList([1])]),
        (put, [set(), []]),
    ]:
        try:
            call(*args)
            out.append(None)
        except (ValueError, TypeError) as error:
            out.append(f"{type(error).__name__}: {error}")
    return out
