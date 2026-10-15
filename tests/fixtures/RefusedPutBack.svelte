<script lang="python">
# A write the template makes, which Svelte refuses, to what a refusal puts back
# in place: the order of a dict's keys, a class read by its name, a
# bytearray's bytes and a function's name and defaults; and to a class whose
# subclasses and bases a write would change, which is refused before it is
# made.
kind: str = "del"


class Table(dict):
    pass


class Holder:
    pass


class Box:
    n = 0

    def __len__(self):
        return 1


def length(self):
    return 99


def handler(a=1):
    return a


class First:
    n = 1

    def __call__(self):
        return 1


class Second:
    n = 99


class Base(First):
    pass


class Sub(Base):
    pass


class Leaf(Sub):
    pass


def calling(self):
    return 99


call = First.__call__
base, sub, leaf = Base(), Sub(), Leaf()
holder = Holder()
holder.a, holder.b, holder.c = 1, 2, 3
table = vars(holder) if kind == "attributes" else Table(a=1, b=2, c=3) if kind == "subclass" else {"a": 1, "b": 2, "c": 3}
box = Box()
data = bytearray(b"abc")


@export
def held():
    if kind in ("del", "pop", "subclass", "attributes"):
        return " ".join(key for key in table if table[key] is not None)
    if kind == "class":
        return str(Box.n)
    if kind == "special method":
        return str(Box.__len__(box))
    if kind.startswith("bytearray"):
        return " ".join(str(one) for one in data)
    if kind == "function name":
        return handler.__name__
    if kind == "subclass call":
        return f"{Base.__call__ is call} {base()} {sub()} {leaf()}"
    if kind == "bases":
        return f"{Base.__bases__ == (First,)} {sub.n} {leaf.n} {issubclass(Sub, First)} {Base in First.__subclasses__()}"
    return str(handler.__defaults__[0])


def attempt():
    try:
        if kind == "pop":
            table.pop("b")
        elif kind in ("del", "subclass", "attributes"):
            del table["b"]
        elif kind == "class":
            Box.n = 1
        elif kind == "special method":
            Box.__len__ = length
        elif kind == "bytearray item":
            data[0] = 120
        elif kind == "bytearray append":
            data.append(120)
        elif kind == "function name":
            handler.__name__ = "other"
        elif kind == "subclass call":
            Base.__call__ = calling
        elif kind == "bases":
            Base.__bases__ = (Second,)
        else:
            handler.__defaults__ = (5,)
    except Exception as error:
        return "refused" if "state_unsafe_mutation" in str(error) else str(error)
    return "written"
</script>

<p>{held()}</p>
<output>{attempt()}</output>
