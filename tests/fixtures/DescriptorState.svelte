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


@export
def change():
    if kind == "data":
        Base.data = 1
    elif kind == "property":
        Base.prop = property(lambda self: 1)
    elif kind == "property to data":
        Base.prop = 1
    elif kind == "method":
        Base.method = lambda self: 1
    elif kind == "shadowing property":
        Middle.prop = property(lambda self: 1)
    else:
        Middle.method = lambda self: 1


def read():
    if kind == "data":
        return holder.data
    if "method" in kind:
        return holder.method()
    return holder.prop


@export
def model():
    return read()
</script>

<output>{read()}</output>
