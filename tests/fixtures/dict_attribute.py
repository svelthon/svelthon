# The `__dict__` attribute as Python reads it: none on an instance whose class
# keeps it out of its `__slots__`, the one `vars()` hands back, and the one a
# `super()` bound to its own type looks up. `python3` on this module gives the
# lines the test expects.
__all__ = ["answers"]


class Slotted:
    __slots__ = ("x",)


class Base:
    @property
    def prop(self):
        return "value"

    def method(self):
        return "method"


class Derived(Base):
    pass


def answers():
    slotted = Slotted()
    slotted.x = 1
    try:
        own = repr(slotted.__dict__)
    except AttributeError as error:
        own = str(error)
    return [
        own,
        repr(hasattr(slotted, "__dict__")),
        type(vars(Base)).__name__,
        type(super(Derived, Derived).prop).__name__,
        type(super(Derived, Derived).method).__name__,
        type(vars(super(Derived, Derived))).__name__,
        super(Derived, Derived()).prop,
    ]
