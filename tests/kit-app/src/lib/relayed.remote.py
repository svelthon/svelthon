"""A remote function answering an instance, which a page the server renders
reads as the browser reads it, rebuilt from what it reduces to; one a factory
of another module makes; and one whose answer a load changes."""

from label import Label, Title, Shelf
from maker import made

__js__ = {"$app/server": ["query"]}
__all__ = ["relayed", "relayed_made", "relayed_changed", "relayed_shelf", "relayed_dicts"]


def _relayed():
    return Label("relayed from python")


def _made():
    return Label("made by a factory")


def _changed():
    return Title("changed by a load")


def _shelf():
    return Shelf()


# Two dicts alike, one twice for a load to take apart, two for one to merge.
def _dicts(mode):
    first = {"label": "A"}
    return [first, first if mode == "split" else {"label": "A"}]


relayed = query(_relayed)
relayed_made = made(_made)
relayed_changed = query(_changed)
relayed_shelf = query(_shelf)
relayed_dicts = query("unchecked", _dicts)
