<script lang="python">
# The differential oracle's attribute matrix. A case is a holder, a read and a
# write, `"class|getattr|setattr"`: `tests/oracle.py` runs this same script
# under CPython, case by case, and `tests/oracle-attributes.test.js` mounts it
# and holds the model and the page against what CPython printed. Every holder
# is bound the way an author binds it, a class by `class` and an instance by
# `=`, since how a value is bound is part of what is watched.
kind: str

holder, how, write = (kind + "||").split("|")[:3]


class Box:
    pass


box = Box()
box.x = 0


class Shared:
    x = 0


shared = Shared()


class _Aliased:
    x = 0


Aliased = _Aliased


class Base:
    x = 0


class Sub(Base):
    pass


sub = Sub()


class Middle(Base):
    pass


class Leaf(Middle):
    pass


leaf = Leaf()


class Derived(Base):
    pass


heir = Derived()


class Meta(type):
    x = 0


class Subject(metaclass=Meta):
    pass


def counter():
    pass


counter.x = 0


class Slotted:
    __slots__ = ("x",)


slotted = Slotted()
slotted.x = 0


class Guarded:
    def __init__(self):
        self._x = 0

    @property
    def x(self):
        return self._x

    @x.setter
    def x(self, value):
        self._x = value


guarded = Guarded()


class Fallback:
    def __getattr__(self, name):
        return "fallback"


fallback = Fallback()


class Bag(dict):
    pass


bag = Bag()
bag.x = 0


class Row(list):
    pass


row = Row()
row.x = 0

failure = ValueError()
failure.x = 0

# What is read, and what is written: the same object for most holders, and the
# class that provides the name for a read made through an instance, a subclass,
# `super()` or a metaclass.
TARGETS = {
    "instance": (lambda: box, lambda: box),
    "class through an instance": (lambda: shared, lambda: Shared),
    "class": (lambda: Shared, lambda: Shared),
    "class bound by =": (lambda: Aliased, lambda: Aliased),
    "subclass": (lambda: Sub, lambda: Base),
    "instance of a subclass": (lambda: sub, lambda: Base),
    "class between": (lambda: leaf, lambda: Middle),
    "super()": (lambda: super(Derived, heir), lambda: Base),
    "super() of a class": (lambda: super(Derived, Derived), lambda: Base),
    "metaclass": (lambda: Subject, lambda: Meta),
    "function": (lambda: counter, lambda: counter),
    "slots": (lambda: slotted, lambda: slotted),
    "property": (lambda: guarded, lambda: guarded),
    "__getattr__": (lambda: fallback, lambda: fallback),
    "dict subclass": (lambda: bag, lambda: bag),
    "list subclass": (lambda: row, lambda: row),
    "exception": (lambda: failure, lambda: failure),
}

READS = {
    "dot": lambda o: o.x,
    "getattr": lambda o: getattr(o, "x"),
    "getattr with a default": lambda o: getattr(o, "x", "absent"),
    "hasattr": lambda o: hasattr(o, "x"),
    "__getattribute__": lambda o: type(o).__getattribute__(o, "x"),
    "vars": lambda o: vars(o).get("x", "absent"),
    "__dict__": lambda o: o.__dict__.get("x", "absent"),
    "dir": lambda o: "x" in dir(o),
}


def assign(target, step):
    target.x = step


def augment(target, step):
    target.x += 1


def into_vars(target, step):
    vars(target)["x"] = step


def into_dict(target, step):
    target.__dict__["x"] = step


# A deletion is the first step, and the second writes the name back.
def removing(remove):
    def write(target, step):
        if step == 1:
            remove(target)
        else:
            target.x = step

    return write


def unbind(target):
    del target.x


WRITES = {
    "assign": assign,
    "setattr": lambda target, step: setattr(target, "x", step),
    "augmented": augment,
    "type.__setattr__": lambda target, step: type(target).__setattr__(target, "x", step),
    "vars": into_vars,
    "__dict__": into_dict,
    "del": removing(unbind),
    "delattr": removing(lambda target: delattr(target, "x")),
    "type.__delattr__": removing(lambda target: type(target).__delattr__(target, "x")),
    # What a field bound to the name writes: its text.
    "binding": lambda target, step: setattr(target, "x", str(step)),
}

CASES = [f"{one}|{read}|{written}" for one in TARGETS for read in READS for written in WRITES]


def target():
    return TARGETS[holder][1]()


def read():
    try:
        return repr(READS[how](TARGETS[holder][0]()))
    except Exception as error:
        return type(error).__name__


@export
def model():
    return read()


@export
def change(step):
    WRITES[write](target(), step)
</script>

<output>{read()}</output>
{#if write == "binding"}<input bind:value={target().x} />{/if}
