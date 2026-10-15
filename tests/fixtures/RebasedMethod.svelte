<script lang="python">
# A class given new bases, and then the new base given a special method anew:
# `len(one)` read each time, of an object of the class or of a subclass.
subclassed: bool = False


class First:
    def __len__(self):
        return 1


class Second:
    def __len__(self):
        return 2


class Holder(First):
    pass


class Child(Holder):
    pass


one = Child() if subclassed else Holder()


def replacement(self):
    return 99


@export
def migrate():
    Holder.__bases__ = (Second,)


@export
def change():
    Second.__len__ = replacement


@export
def model():
    return len(one)
</script>

<output>{len(one)}</output>
