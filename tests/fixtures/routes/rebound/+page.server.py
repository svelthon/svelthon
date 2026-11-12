def _second(event):
    return {"phase": "second"}


def load(event):
    global load
    load = _second
    return {"phase": "first"}
