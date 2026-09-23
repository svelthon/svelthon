# What an absence is once it has crossed into Python: the guard is written in
# Python, so it is read in Python, not after the value has come back.
def absent(value):
    return value is None


def route_absent(event):
    return event["route"] is None


def fallback(event):
    slug = event["params"]["slug"]
    return "index" if slug is None else str(slug)
