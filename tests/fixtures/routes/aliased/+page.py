def _first(event):
    global load
    load = _second
    return {"phase": "first"}


def _second(event):
    return {"phase": "second"}


load = _first
