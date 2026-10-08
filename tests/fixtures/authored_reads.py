# Containers whose reads are the author's code, each counting them: a dict, a
# list and a tuple with their own `__getitem__`, an instance with its own
# `__getattribute__`. `make` builds a fresh one and clears the count; a read
# answers the value, the count so far, or raises.
__all__ = ["made", "make", "reads"]

events = []
made = None
mode = "same"


def record(value):
    events.append(1)
    if mode == "raising":
        raise ValueError("value was read")
    return len(events) if mode == "counting" else value


class Table(dict):
    def __getitem__(self, key):
        return record(super().__getitem__(key))


class Rows(list):
    def __getitem__(self, at):
        return record(super().__getitem__(at))


class Pair(tuple):
    def __getitem__(self, at):
        return record(super().__getitem__(at))


class Row:
    def __init__(self):
        self.value = 42

    def __getattribute__(self, name):
        found = object.__getattribute__(self, name)
        return record(found) if name == "value" else found


# And an instance whose reads are Python's own, which holds its values.
class Plain:
    def __init__(self):
        self.value = 42


def make(kind, how="same"):
    global made, mode
    mode = "same"
    made = {"dict": lambda: Table(value=42), "list": lambda: Rows([42]), "tuple": lambda: Pair((42,)),
            "instance": Row, "plain": Plain}[kind]()
    events.clear()
    mode = how


def reads():
    return len(events)
