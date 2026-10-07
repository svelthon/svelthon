# Sets a module exports and writes into a JavaScript object, changed in place.
__all__ = ["tags", "frozen", "pairs", "box", "mutate", "seen", "walked", "refill", "put_back", "keep_only"]

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


def refill(members=None):
    walked.clear()
    walked.update([1, 2, 3] if members is None else members)


# A member deleted and added back by Python, or the set cleared and it added.
def put_back(clear, member):
    if clear:
        walked.clear()
    else:
        walked.discard(member)
    walked.add(member)


# The members kept, the others removed, in one call that rebuilds the buckets.
def keep_only(members):
    walked.intersection_update(members)
