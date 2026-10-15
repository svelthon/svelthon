<script lang="python">
# A special method given anew to a class, which an operation looks up and no
# read names: `len(one)`, `one()`, `for row in one`, `one.unknown`, on an
# instance of the class or of a subclass.
kind: str = "len"
subclassed: bool = False


class Base:
    def __len__(self):
        return 1

    def __call__(self):
        return 1

    def __iter__(self):
        return iter([1])

    def __getattr__(self, name):
        return 1


class Sub(Base):
    pass


one = Sub() if subclassed else Base()


def replacement(self, name=None):
    return iter([99]) if kind == "iter" else 99


def value():
    if kind == "len":
        return len(one)
    if kind == "call":
        return one()
    if kind == "iter":
        return list(one)[0]
    return one.unknown


@export
def change():
    setattr(Base, f"__{kind}__", replacement)


@export
def model():
    return value()
</script>

<output>{value()}</output>
