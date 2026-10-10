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
    # The same reads, made through `super()`.
    def through_super(self):
        if kind == "data read through super()":
            return super().data
        if kind == "property read through super()":
            return super().prop
        if kind == "method read through super()":
            return super().method()
        return getattr(super(), "extra", 0)


holder = Derived()


# A class reading what its metaclass provides.
class Meta(type):
    data = 0

    @property
    def prop(cls):
        return 0

    def method(cls):
        return 0


class Subject(metaclass=Meta):
    pass


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
    if kind in ("data", "data read through super()", "data read through super() of a class"):
        Base.data = 1
    elif kind in ("property", "property read through super()"):
        Base.prop = property(lambda self: 1)
    elif kind == "property to data":
        Base.prop = 1
    elif kind in ("method", "method read on its class", "method read on a subclass", "method read through super()"):
        Base.method = lambda self: 1
    elif kind == "data read on its class":
        Base.data = 1
    elif kind == "data of its metaclass":
        Meta.data = 1
    elif kind == "property of its metaclass":
        Meta.prop = property(lambda cls: 1)
    elif kind == "method of its metaclass":
        Meta.method = lambda cls: 1
    elif kind == "name its metaclass gains":
        Meta.extra = 1
    elif kind == "name a class gains, read through super()":
        Base.extra = 1
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
    if kind == "data read through super() of a class":
        return super(Derived, Derived).data
    if "super()" in kind:
        return holder.through_super()
    if kind == "data of its metaclass":
        return Subject.data
    if kind == "property of its metaclass":
        return Subject.prop
    if kind == "method of its metaclass":
        return Subject.method()
    if kind == "name its metaclass gains":
        return getattr(Subject, "extra", 0)
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
