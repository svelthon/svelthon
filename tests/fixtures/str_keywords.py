# A key that is a subclass of str names a keyword argument by its value, and
# stays the key it is in **kwargs and in dict().
class Name(str):
    pass


def take(text):
    return text


def gather(**kw):
    return kw


def by_subclass():
    return take(**{Name("text"): "Café"})


def kept_types():
    return [type(next(iter(gather(**{Name("a"): 1})))).__name__,
            type(next(iter(dict(**{Name("a"): 1})))).__name__]
