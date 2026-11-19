# What `to_json` writes of a dict's key order and of a float, beside what
# CPython's `json.dumps` writes of the same, with the separators `to_json` uses.
__all__ = ["written"]


class Stamp(float):
    def __repr__(self):
        return "Stamp!"


VALUES = {
    "order": {"a": 1, 2: (1,), "b": {"10": 2, "x": 3}},
    "keys": {1.5: "x", True: "t", None: "n", 3: "three"},
    "float": 2.0,
    "floats": [1.0, 0.1, 1e16, 1e-07, -0.0, Stamp(3.0), 1.5e300],
}


def written(name, indent=None):
    return to_json(VALUES[name], indent)
