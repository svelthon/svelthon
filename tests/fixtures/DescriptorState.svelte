<script lang="python">
# A property or a method replaced on a class, or shadowed by one between it and
# the instance, changes what the instance reads, as a class constant replaced
# does: the witness.
kind: str = "data"


class Base:
    data = 0

    @property
    def prop(self):
        return 0

    def method(self):
        return 0


class Middle(Base):
    pass


class Derived(Middle):
    pass


holder = Derived()


# A shadow deleted: the method of the class above shows through again.
class Above:
    def method(self):
        return 1


class Shadowing(Above):
    def method(self):
        return 0


class Below(Shadowing):
    pass


below = Below()


# An attribute of an instance's own, deleted by the builtin.
class Box:
    pass


box = Box()
box.data = 1


@export
def change():
    if kind == "data":
        Base.data = 1
    elif kind == "property":
        Base.prop = property(lambda self: 1)
    elif kind == "property to data":
        Base.prop = 1
    elif kind in ("method", "method read on its class", "method read on a subclass"):
        Base.method = lambda self: 1
    elif kind == "data read on its class":
        Base.data = 1
    elif kind == "shadowing property":
        Middle.prop = property(lambda self: 1)
    elif kind == "shadowing method":
        Middle.method = lambda self: 1
    elif kind == "shadow deleted":
        del Shadowing.method
    elif kind == "shadow deleted by delattr()":
        delattr(Shadowing, "method")
    elif kind == "shadow deleted by type.__delattr__":
        type.__delattr__(Shadowing, "method")
    elif kind == "property set by type.__setattr__":
        type.__setattr__(Base, "prop", property(lambda self: 1))
    elif kind == "instance attribute deleted by delattr()":
        delattr(box, "data")
    elif kind == "name a class gains":
        Base.extra = 1
    elif kind == "property a class gains":
        Base.extra = property(lambda self: 1)
    else:
        Middle.later = lambda self: 1


def read():
    if kind == "data":
        return holder.data
    # Read on the class itself, bound by `class` and not by `=`.
    if kind == "method read on its class":
        return Base.method(holder)
    if kind == "method read on a subclass":
        return Derived.method(holder)
    if kind == "data read on its class":
        return Base.data
    if kind.startswith("shadow deleted"):
        return below.method()
    if kind == "instance attribute deleted by delattr()":
        return 0 if hasattr(box, "data") else 1
    if kind in ("name a class gains", "property a class gains"):
        return getattr(holder, "extra", 0)
    if kind == "method a class gains":
        return 1 if hasattr(holder, "later") else 0
    if "method" in kind:
        return holder.method()
    return holder.prop


@export
def model():
    return read()
</script>

<output>{read()}</output>
