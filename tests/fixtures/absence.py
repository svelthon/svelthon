# What an absence and a null are once they have crossed into Python: the guard
# is written in Python, so it is read in Python, not after the value has come
# back.
import javascript


def absent(value):
    return value is None


def is_null(value):
    return value is javascript.NULL


def route_null(event):
    return event["route"] is javascript.NULL


def fallback(event):
    slug = event["params"]["slug"]
    return "index" if slug is None else str(slug)
