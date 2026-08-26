# What a dict looks like once it has crossed into another module, in each of the
# three directions a store is used in.
seen = ""
table = {"k": "v"}


def keep(entry):
    global seen
    seen = "{} dict={}".format(type(entry).__name__, isinstance(entry, dict))


def give():
    return {"k": "v"}
