"""A label that crosses to the browser rebuilt in capitals with a mark, which a
second rebuild would mark again, and what is read of it: a page the server
renders reads it as the browser does. And a title rebuilt in capitals, which a
second rebuild leaves as it is, and a shelf that counts its reductions."""

__all__ = ["Label", "Title", "Shelf", "read", "regroup", "sharing"]


class Label:
    def __init__(self, text):
        self.text = text

    def __reduce__(self):
        return (Label, (self.text.upper() + "!",))


class Title:
    def __init__(self, text):
        self.text = text

    def __reduce__(self):
        return (Title, (self.text.upper(),))


# And a shelf whose reduction counts the times it is pickled: one round trip,
# as CPython's, reads `shelf:1`.
class Shelf:
    def __init__(self, count=0):
        self.count = count

    def __reduce__(self):
        self.count += 1
        return (Shelf, (self.count,))


def read(label):
    return label.text


# A pair a load takes apart or makes of one, and whether it shares one.
def regroup(pair, mode):
    pair[1] = {"label": "A"} if mode == "split" else pair[0]
    return pair


def sharing(pair):
    return "shared" if pair[0] is pair[1] else "apart"
