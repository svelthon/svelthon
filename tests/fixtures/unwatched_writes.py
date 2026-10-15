# Writes to objects nobody watches: by subscript, to a list and a dict, and by
# attribute, to an instance.
__all__ = ["write"]


class Box:
    pass


def write(n):
    rows = [0] * n
    table = {}
    box = Box()
    for i in range(n):
        rows[i] = i
        table["k"] = i
        box.x = i
    return rows[-1] + table["k"] + box.x
