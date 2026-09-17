# What `to_py` does with values that are already Python, and with data whose
# field names look like the engine's.
__all__ = ["already", "with_helper", "helper_is_untouched", "field_named_type"]


class Plain:
    def __init__(self):
        self.n = 1


class Helpful:
    # An ordinary serialisation helper. Its name is the one the boundary used to
    # probe for, so defining it was enough to break a conversion that had
    # nothing to convert.
    def __init__(self):
        self.n = 1

    def to_dict(self):
        return {"changed": True}


plain = Plain()
helpful = Helpful()


def already():
    return to_py(plain) is plain


def with_helper():
    return to_py(helpful) is helpful


def helper_is_untouched():
    # The method is still there and still answers: nothing was called behind the
    # author's back.
    return helpful.to_dict()["changed"]


def field_named_type(value):
    # A JavaScript object whose field is called `ob_type` is data, not a Python
    # object. What comes back must be a dict Python can read.
    converted = to_py(value)
    return [converted["ob_type"], converted["value"]]
