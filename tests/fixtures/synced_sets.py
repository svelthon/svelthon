# Sets a module exports and writes into a JavaScript object, changed in place.
__all__ = ["tags", "frozen", "pairs", "box", "mutate", "seen", "walked", "refill", "fill_cells", "drop_next",
           "put_back", "keep_only", "clear_then_add"]

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


# Cells, as a program keeps a position and the tags it carries, and the one
# after a cell deleted by Python, which a walk has not reached yet.
def fill_cells(n):
    walked.clear()
    walked.update((i, frozenset()) for i in range(n))


def drop_next(cell):
    walked.discard((cell[0] + 1, frozenset()))


# A member deleted and added back by Python, or the set cleared and it added.
def put_back(clear, member):
    if clear:
        walked.clear()
    else:
        walked.discard(member)
    walked.add(member)


# Emptied, then given its members back one at a time, in the order given.
def clear_then_add(*members):
    walked.clear()
    for member in members:
        walked.add(member)


# The members kept, the others removed, in one call that rebuilds the buckets
# and may keep the other set's object for a member, written three ways.
def keep_only(members, how="method"):
    global walked
    other = set(float(str(one)) if isinstance(one, float) else one for one in members)
    if how == "method":
        walked.intersection_update(other)
    elif how == "dunder":
        walked.__iand__(other)
    else:
        walked &= other
