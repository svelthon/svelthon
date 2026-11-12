def _active(event):
    return {"phase": "active"}


def enable(event):
    global load
    load = _active


def disable(event):
    global load
    load = None


actions = {"enable": enable, "disable": disable}

if False:
    load = _active
