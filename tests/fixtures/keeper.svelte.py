# What a container looks like once it has crossed into another module, in each
# of the directions a module is used in. One of each kind, since a dict, a list
# and a set take three different paths through Brython's conversion.
table = {"k": "v"}
rows = [1, 2]
tags = {"a", "b"}


def describe(value):
    # The class name is what catches a container that came back as a JavaScript
    # view of itself; len() catches one that kept the name and lost the
    # behaviour.
    return "{} len={}".format(type(value).__name__, len(value))


def looks(value):
    # The argument direction: what this module was handed, carried back as a
    # string rather than as the container itself, so the answer cannot be spoilt
    # by the return trip.
    return describe(value)


def give(kind):
    # The return direction. The argument is a string, which crosses either way
    # without conversion.
    return {"dict": {"k": "v"}, "list": [1, 2], "set": {"a", "b"}}[kind]
