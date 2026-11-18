# What `to_json` does with a call, in the three shapes Python writes one and the
# three positions a serialiser meets one.
#
# Written in Python rather than assembled in JavaScript because that is where the
# helper is called from: `{to_json(registry)}` in a template, with the author's own
# values.
__js__ = {"./to_json_helper.js": ["formatted"]}
__all__ = ["says", "control", "keeps_an_instance", "coroutine_says"]


class Handler:
    def __init__(self):
        self.factor = 2

    def __call__(self):
        return 42


class Rows(list):
    def __call__(self):
        return 42


class Pair(tuple):
    def __call__(self):
        return 42


class Bag(dict):
    def __call__(self):
        return 42


class Box:
    def __init__(self):
        self.n = 1

    def save(self):
        return 1


def plain():
    return 2


handler = Handler()
box = Box()

SHAPES = {
    "function": plain,
    "lambda": lambda: 2,
    "method": box.save,
    "instance": handler,
    # Containers that are callables too: a list and a tuple are arrays to
    # JavaScript, and a dict keeps its class under a symbol.
    "list": Rows([1]),
    "tuple": Pair((1,)),
    "dict": Bag(),
    # The one shape Python cannot name at all: what it knows is
    # `<JavascriptFunction object>`, identically for every import.
    "javascript": formatted,
}

POSITIONS = {
    "alone": lambda one: one,
    "list": lambda one: [one],
    "dict": lambda one: {"on_save": one},
    "deep": lambda one: {"handlers": [one]},
}


calls = []


async def work():
    calls.append(1)
    return {"answer": 42}


pending = work()
nested_pending = {"task": work()}


def coroutine_says(where):
    # The count is read *before* and after, because the defect was not the
    # answer: it was that asking for the answer ran the body.
    before = len(calls)

    try:
        written = "returned " + str(to_json(pending if where == "alone" else nested_pending))
    except Exception as error:
        written = str(error)

    return [written, before, len(calls)]


def says(shape, position):
    # The message, or the text of what came out when nothing was refused, which
    # is what makes the three silences visible in one place.
    try:
        return "returned " + str(to_json(POSITIONS[position](SHAPES[shape])))
    except Exception as error:
        return str(error)


def control(key):
    # The same containers holding data, which must still serialise.
    return to_json(POSITIONS[key]({"n": 1}))


def keeps_an_instance():
    # An ordinary instance is its fields, which is Svelthon's own answer and not
    # CPython's: the refusal is about a call, not about being an object.
    return to_json(box)
