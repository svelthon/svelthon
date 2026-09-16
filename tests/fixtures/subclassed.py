# Subclasses that redefine nothing, which is what makes them a control: whatever
# differs between these and the builtin is the framework's decision, not a
# protocol of the author's.
__all__ = ["mapping", "decorated", "plain", "keys_before", "nested", "shared"]


class Mapping(dict):
    pass


def mapping():
    return Mapping({"answer": 42})


def decorated():
    # A dict subclass may carry instance attributes beside its entries. They are
    # metadata about the mapping, not entries of it.
    result = Mapping({"answer": 42})
    result.label = "metadata"
    return result


def plain():
    return {"answer": 42}


def keys_before():
    # Python's own answer, read before anything crosses.
    return list(Mapping({"answer": 42}).keys())


def nested():
    return Mapping({"rows": Mapping({"answer": 42})})


def shared():
    rows = [1]
    return Mapping({"a": rows, "b": rows})
