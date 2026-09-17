# What `tojson` does with a call, in the three shapes Python writes one and the
# three positions a serialiser meets one.
#
# Written in Python rather than assembled in JavaScript because that is where the
# helper is called from: `{tojson(registry)}` in a template, with the author's own
# values.
__js__ = {"./tojson_helper.js": ["formatted"]}
__all__ = ["says", "control", "keeps_an_instance"]


class Handler:
    def __init__(self):
        self.factor = 2

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


def says(shape, position):
    # The message, or the text of what came out when nothing was refused, which
    # is what makes the three silences visible in one place.
    try:
        return "returned " + str(tojson(POSITIONS[position](SHAPES[shape])))
    except Exception as error:
        return str(error)


def control(key):
    # The same containers holding data, which must still serialise.
    return tojson(POSITIONS[key]({"n": 1}))


def keeps_an_instance():
    # An ordinary instance is its fields, which is Svelthon's own answer and not
    # CPython's: the refusal is about a call, not about being an object.
    return tojson(box)
