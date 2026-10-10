# Special methods taken off a builtin, or off its type, published to
# JavaScript and handed to it as callbacks.
__js__ = {"./special_methods_calls.js": ["call_with"]}
__all__ = [
    "write", "second", "length", "put", "index_of", "rows", "shape",
    "read", "shown", "passed", "table_value", "get_from", "scores", "kind_of"
]

rows = [0]
table = {}
write = rows.__setitem__
second = rows.__setitem__
length = rows.__len__
put = table.__setitem__
index_of = list.index
get_from = dict.get
scores = {"answer": 42}


def kind_of(value):
    return type(value).__name__


def shape():
    setter = rows.__setitem__
    return [type(setter).__name__, setter.__self__ is rows]


def read():
    return str(round(rows[0], 1))


def table_value():
    return str(round(table["k"], 1))


def shown():
    return repr(rows.__setitem__)


def passed():
    call_with(rows.__setitem__, 0, 0.5)
    return read()
