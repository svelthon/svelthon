# Callables held in a set, and a dict keyed by a JavaScript object whose name
# changes.
__js__ = {"./renamed_key.js": ["key"]}
__all__ = ["functions", "runners", "mapping"]


def f():
    return "f"


class Runner:
    def __call__(self):
        return "runner"


functions = {f}
runners = {Runner()}
mapping = {key: 42}
