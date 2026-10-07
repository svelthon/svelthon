# Values whose class raises where JavaScript reads them through a view: an
# index, a property, a size, a membership, an entry.
__js__ = {"./iterated_sets_walk.js": ["read", "size", "holds"]}
__all__ = ["rows", "box", "bag", "table", "caught"]


class Rows(list):
    def __getitem__(self, index):
        raise ValueError("no row")


class Box:
    @property
    def value(self):
        raise ValueError("no value")


class Bag(set):
    def __len__(self):
        raise ValueError("no size")

    def __contains__(self, one):
        raise ValueError("no answer")


class Table(dict):
    def __getitem__(self, key):
        raise ValueError("no entry")


rows = Rows([1, 2])
box = Box()
bag = Bag([1])
table = Table(a=1)


def caught():
    # What this module catches when JavaScript reads, through a view, a value
    # this module handed it.
    out = []
    for call, args in [
        (read, [rows, 0]),
        (read, [box, "value"]),
        (size, [bag]),
        (holds, [bag, 1]),
        (read, [table, "a"]),
        (holds, [{1}, []]),
    ]:
        try:
            out.append(call(*args))
        except ValueError as error:
            out.append(f"ValueError: {error}")
    return out
