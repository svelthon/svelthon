# A module whose functions a component names directly in a handler.
seen = 0
args = -1


def bump():
    global seen
    seen += 1


def one(event):
    # Declares one parameter, so it must receive the DOM event and nothing else.
    global args
    args = 1 if event is not None else 0
