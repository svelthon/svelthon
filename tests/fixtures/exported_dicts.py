# A module exporting dicts that hold functions, in the three shapes the export
# used to treat differently: all functions, functions beside a value, and a key
# JavaScript reads as more than a key.
__all__ = [
    "pure",
    "mixed",
    "special",
    "data",
    "proto_in_python",
    "proto_keys",
    "aliased",
    "aliased_with_fn",
    "cyclic_with_fn",
]


async def answer():
    return 42


def twice(n):
    return n * 2


pure = {"answer": answer, "twice": twice}

# The neighbour that used to change `answer`'s calling contract.
mixed = {"answer": answer, "twice": twice, "version": 1, "tags": ["a"]}

# `__proto__` is a key like any other in Python.
special = {"__proto__": twice, "kept": 1}

data = {"version": 1}

# One list under two keys. The export takes a different branch when a function
# is present, and that branch used to decide whether these two keys still name
# the same list on the other side.
shared = [1]

aliased = {"a": shared, "b": shared}
aliased_with_fn = {"a": shared, "b": shared, "twice": twice}

# And the dict pointing back at itself, which is what makes the export register
# its own container rather than only the values under it.
cyclic_with_fn = {"twice": twice}
cyclic_with_fn["self"] = cyclic_with_fn

# What Python itself makes of that key, since JavaScript is not the only layer
# that reads `__proto__` as something other than a name.
proto_in_python = "__proto__" in special
proto_keys = list(special.keys())
