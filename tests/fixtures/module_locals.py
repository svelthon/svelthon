# locals() called with arguments at the top of a module and in a function:
# `python3` refuses the four bad calls at both levels and accepts the fifth.
__all__ = ["top", "inside"]

top = []
for mode in ["positional", "none", "starred", "keyword", "empty"]:
    try:
        if mode == "positional":
            locals(1)
        elif mode == "none":
            locals(None)
        elif mode == "starred":
            locals(*[1])
        elif mode == "keyword":
            locals(unexpected=1)
        else:
            locals(*[])
        top.append("accepted")
    except TypeError:
        top.append("TypeError")
top.append(locals() is globals())


def inside():
    out = []
    for mode in ["positional", "none", "starred", "keyword", "empty"]:
        try:
            if mode == "positional":
                locals(1)
            elif mode == "none":
                locals(None)
            elif mode == "starred":
                locals(*[1])
            elif mode == "keyword":
                locals(unexpected=1)
            else:
                locals(*[])
            out.append("accepted")
        except TypeError:
            out.append("TypeError")
    return out
