# What an unhashable value is refused with, by hash(), by a set and by a dict,
# and what passes through unchanged: `python3` gives these same lines, the
# module's name aside.
__all__ = ["refusals"]


class Outer:
    class Refuses:
        def __hash__(self):
            raise TypeError("mine")


class Fails:
    def __hash__(self):
        raise ValueError("mine")


def refusals():
    out = [__name__]
    for run in [
        lambda: hash([1]),
        lambda: {[1]},
        lambda: set().add([1]),
        lambda: [1] in {1},
        lambda: {[1]: 1},
        lambda: [1] in {"a": 2},
        lambda: {Outer.Refuses()},
        lambda: Fails() in {1},
    ]:
        try:
            run()
            out.append(None)
        except Exception as error:
            out.append(f"{type(error).__name__}: {error}")
    return out
