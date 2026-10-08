# What a builtin that takes no arguments says when given one, by position or
# by name, at the top of a module and in a function: `python3` gives these
# same lines.
__all__ = ["top", "inside"]


def refusals():
    out = []
    for run in [lambda: globals(1), lambda: globals(x=1), lambda: locals(1), lambda: locals(x=1)]:
        try:
            run()
            out.append(None)
        except TypeError as error:
            out.append(str(error))
    return out


top = []
for mode in ["positional", "keyword"]:
    try:
        if mode == "positional":
            locals(1)
        else:
            locals(x=1)
    except TypeError as error:
        top.append(str(error))


def inside():
    return refusals()
