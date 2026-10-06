# Sets a module exports and writes into a JavaScript object, changed in place.
__all__ = ["tags", "frozen", "pairs", "box", "mutate", "seen"]

tags = {"a"}
frozen = frozenset({1, 2})
pairs = {(1, 2)}

box = js.Object.new()
box.tags = tags


def mutate():
    tags.add("b")


def seen():
    return sorted(tags)
