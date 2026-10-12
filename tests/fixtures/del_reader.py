# The names of `del_matrix` as another module reads them: an attribute, a
# `from` import, and `getattr` with a default.
__all__ = ["outside"]

import del_matrix


def imported(name):
    try:
        if name == "state":
            from del_matrix import state
        elif name == "helper":
            from del_matrix import helper
        else:
            from del_matrix import twice
        return "found"
    except ImportError:
        return "ImportError"


def outside(name):
    try:
        getattr(del_matrix, name)
        read = "found"
    except AttributeError:
        read = "AttributeError"

    fallback = "default" if getattr(del_matrix, name, "default") == "default" else "value"
    return f"{read} {imported(name)} {fallback} {hasattr(del_matrix, name)}"
