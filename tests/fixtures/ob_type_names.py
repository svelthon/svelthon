# A name Brython also uses, `ob_type`, as a module global, a dict key, an
# attribute and a local; and the frame of a method, which `super()` reads its
# class from and `locals()` lists.
__all__ = ["spelled", "method"]

ob_type = 42
ordinary = 5


class Box:
    pass


class Base:
    def tag(self):
        return "base"


# CPython also lists `__class__` in a method that calls `super()`, which Brython
# leaves out, a divergence of its own: it is set aside here.
class Card(Base):
    def fields(self):
        x = 1
        seen, held = sorted(locals()), sorted(vars())
        return [k for k in seen if k != "__class__"], "x" in locals(), [k for k in held if k != "__class__"], super().tag()


def spelled():
    box = Box()
    box.ob_type = 1
    keyed = {"ob_type": 1, "x": 2}
    keyed["y"] = 3
    classy = {"ob_type": int, "x": 1}

    def local():
        ob_type = 1
        return sorted(locals())

    return [
        globals()["ordinary"],
        globals()["ob_type"],
        type(globals()).__name__,
        box.ob_type,
        sorted(vars(box)),
        len(keyed),
        type(keyed).__name__,
        local(),
        [len(classy), type(classy).__name__],
    ]


def method():
    return list(Card().fields())
