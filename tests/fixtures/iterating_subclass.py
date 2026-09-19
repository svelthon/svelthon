# A list subclass that says what iterating it means, and a foreign object whose
# data happens to be spelled like the engine's mark.
__js__ = {"./foreign_record.js": ["record", "control", "tagged_rows", "plain_rows"]}
__all__ = ["rows", "plain", "python_order", "encoded", "batched", "converted"]


class Reverse(list):
    def __iter__(self):
        return iter([3, 2, 1])


rows = Reverse([1, 2, 3])
plain = [1, 2, 3]


def python_order():
    # What Python itself does with the same object, which is the reference the
    # template has to match.
    return [x for x in rows]


def encoded():
    # A JavaScript object carrying a field called `ob_type`, the Python dict of
    # the same shape, and the control without that name.
    return [urlencode(record()), urlencode({"ob_type": "business", "value": 42}), urlencode(control())]


def batched():
    return [str(batch(rows, 2)), str(batch(plain, 2))]


def converted():
    # What `to_py` promises: a JavaScript array arrives as a Python list, with
    # `.copy()`, `.index()` and `isinstance(x, list)` behind it. A field that
    # happens to be spelled like the engine's mark does not change that.
    def named(value):
        try:
            return type(to_py(value)).__name__
        except AttributeError:
            return "AttributeError"

    return [named(tagged_rows()), named(plain_rows())]
