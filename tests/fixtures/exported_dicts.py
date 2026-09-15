# A module exporting dicts that hold functions, in the three shapes the export
# used to treat differently: all functions, functions beside a value, and a key
# JavaScript reads as more than a key.
__all__ = ["pure", "mixed", "special", "data", "proto_in_python", "proto_keys"]


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

# What Python itself makes of that key, since JavaScript is not the only layer
# that reads `__proto__` as something other than a name.
proto_in_python = "__proto__" in special
proto_keys = list(special.keys())
