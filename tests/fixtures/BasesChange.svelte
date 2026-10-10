<script lang="python">
# A class given new bases, `C.__bases__ = (B,)`, and what reads through it: the
# name it now finds on `B`, from the class, a subclass, an instance no name holds
# and `super()`, and the order itself, through `issubclass`, `isinstance` and
# `__mro__`.
kind: str = "class"


class A:
    value = 0


class B:
    value = 1


class C(A):
    pass


class D(C):
    pass


item = C()


def read():
    if kind == "class":
        return C.value
    if kind == "subclass":
        return D.value
    if kind == "instance made in the expression":
        return C().value
    if kind == "super()":
        return super(C, item).value
    if kind == "issubclass":
        return issubclass(C, B)
    if kind == "isinstance":
        return isinstance(C(), B)
    return ",".join(cls.__name__ for cls in C.__mro__)


@export
def change():
    C.__bases__ = (B,)


@export
def model():
    return str(read())
</script>

<output>{read()}</output>
