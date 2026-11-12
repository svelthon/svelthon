__all__ = ["load", "_same", "_other", "_restore"]


def load(event):
    return {"phase": "first"}


_first = load


def _second(event):
    return {"phase": "second"}


def _same():
    global load
    load = load


def _other():
    global load
    load = _second


def _restore():
    global load
    load = _first
