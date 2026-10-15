# Dicts and sets whose membership answers apart from their storage, as Python
# allows: `__contains__` decides `in`, and reading, writing, deleting and
# `discard` do not ask it.
__all__ = ["hiding", "raising", "counting", "asked", "member", "kept", "hidden", "hashed", "python_answers"]

calls = []
hashes = []


class Hiding(dict):
    def __contains__(self, key):
        return False


class Raising(dict):
    def __contains__(self, key):
        raise ValueError("no membership")


class Counting(dict):
    def __contains__(self, key):
        calls.append(key)
        return dict.__contains__(self, key)


class Member:
    def __hash__(self):
        hashes.append(1)
        return 7


class HidingSet(set):
    def __contains__(self, one):
        return False


hiding = Hiding(x=7)
raising = Raising(x=7)
counting = Counting(x=7)
member = Member()
kept = {member}
hidden = HidingSet([1, 2])


def asked():
    return len(calls)


def hashed():
    return len(hashes)


# The witness: the same operations written in Python.
def python_answers():
    bag = Hiding(x=7)
    read = bag["x"]
    member_in = "x" in bag
    del bag["x"]
    loud = Raising(x=7)
    loud["y"] = 8
    del loud["x"]
    gone = HidingSet([1, 2])
    gone.discard(1)
    return [read, member_in, len(bag), sorted(dict.keys(loud)), len(gone)]
