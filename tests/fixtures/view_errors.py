# Values whose class raises where JavaScript reads them through a view: an
# index, a property, a size, a membership, an entry, a text.
__js__ = {"./iterated_sets_walk.js": ["read", "size", "holds", "text"]}
__all__ = ["rows", "box", "bag", "table", "type_bag", "text_box", "compared", "caught"]


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


class TypeBag(set):
    # A membership that fails with a TypeError, for a hashable value.
    def __contains__(self, one):
        raise TypeError("membership failed")


class TextBox:
    def __str__(self):
        raise ValueError("no text")


class Compared:
    # Equal to something, so hashed by nothing: `__hash__` is None.
    def __eq__(self, other):
        return True


rows = Rows([1, 2])
box = Box()
bag = Bag([1])
table = Table(a=1)
type_bag = TypeBag([1])
text_box = TextBox()
compared = Compared()


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
        (holds, [type_bag, 1]),
        (text, [text_box]),
    ]:
        try:
            out.append(call(*args))
        except (ValueError, TypeError) as error:
            out.append(f"{type(error).__name__}: {error}")
    return out
