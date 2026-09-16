# The three shapes of a Python callable, in the two positions an export has: a
# name of its own, and a value of a mapping.
__js__ = {"./js_calls.js": ["invoke", "kindOf"]}
__all__ = [
    "top",
    "actions",
    "instance_probe",
    "method_probe",
    "local_probe",
    "wrapped_probe",
    "instance_kind",
    "two_instances",
]


class Handler:
    def __init__(self, label):
        self.label = label

    def run(self):
        return 42

    def __call__(self, suffix):
        return self.label + suffix


handler = Handler("a")
other = Handler("b")

# A bound method as the exported value itself, beside the mapping that already
# works: same Python object, two positions.
top = handler.run
actions = {"default": handler.run}


def instance_probe():
    return invoke(handler)


def method_probe():
    return invoke(handler.run)


def local_probe():
    return handler("event")


def wrapped_probe():
    return invoke(lambda suffix: handler(suffix))


def instance_kind():
    return kindOf(handler)


def two_instances():
    # Two instances of one class: their `__call__` must not share a wrapper.
    return [invoke(handler), invoke(other)]
