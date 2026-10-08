# What a builtin function or method says when given the wrong number of
# arguments: `python3` gives these same lines.
__all__ = ["refusals"]


def refusals():
    out = []
    for run in [lambda: abs(), lambda: len(1, 2), lambda: divmod(1), lambda: isinstance(1, 2, 3),
                lambda: set().add(), lambda: [].append(1, 2), lambda: "a".join(), lambda: str.join("a")]:
        try:
            run()
            out.append(None)
        except TypeError as error:
            out.append(str(error))
    return out
