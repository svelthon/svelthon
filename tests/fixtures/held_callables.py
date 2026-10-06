# Callables held in a set, and a dict keyed by a JavaScript object whose name
# changes.
__js__ = {"./renamed_key.js": ["key"]}
__all__ = ["functions", "runners", "mapping", "touch"]


def f():
    return "f"


class Runner:
    def __call__(self):
        return "runner"


functions = {f}
runners = {Runner()}
mapping = {key: 42}


# A change of the dict's keys, which names them again.
def touch():
    mapping["other"] = 0
