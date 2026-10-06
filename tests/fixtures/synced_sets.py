# Sets a module exports and writes into a JavaScript object, changed in place.
__all__ = ["tags", "frozen", "pairs", "box", "mutate", "seen", "walked", "refill", "put_back"]

tags = {"a"}
frozen = frozenset({1, 2})
pairs = {(1, 2)}

box = js.Object.new()
box.tags = tags


def mutate():
    tags.add("b")


def seen():
    return sorted(tags)


# A set walked from JavaScript while it changes, refilled before each walk.
walked = {1, 2, 3}


def refill():
    walked.clear()
    walked.update([1, 2, 3])


# 1 deleted and added back by Python, or the set cleared and 1 added.
def put_back(clear):
    if clear:
        walked.clear()
    else:
        walked.discard(1)
    walked.add(1)
