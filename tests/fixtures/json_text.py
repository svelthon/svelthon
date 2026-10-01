# A subclass of str holding JSON, read through the engine's JSON and through
# `from_json`. The second class gives itself another display, which must not
# stand in for its content.
from javascript import JSON

__all__ = ["engine", "helper"]


class Text(str):
    pass


class Shown(str):
    def __str__(self):
        return "shown"


def engine():
    return [JSON.parse(cls('{"answer": 42}'))["answer"] for cls in (Text, Shown)]


def helper():
    return [from_json(cls('{"answer": 42}'))["answer"] for cls in (Text, Shown)]
