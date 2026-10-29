# A store function the module hands a registry, a list of floats it returns,
# and what Python reads of that list.
__js__ = {"./kept_registry.js": ["hold"]}
held = [0.25]


def get_value():
    return held


def read_value():
    return held[0]


def action():
    return 7


hold(action)
