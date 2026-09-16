# Python calling JavaScript, where what JavaScript does with the values is read
# something other than their contents: the identity of a callback, and the
# identity of two arguments to one call.
__js__ = {"./js_calls.js": ["on", "off", "ping", "alias", "aliasBundle"]}
__all__ = [
    "listen",
    "stop",
    "emit",
    "count",
    "listen_other",
    "other_count",
    "aliased",
    "bundled",
]

events = []
others = []


def handler():
    events.append(1)


def other():
    others.append(1)


def listen():
    on(handler)


def stop():
    off(handler)


def listen_other():
    on(other)


def emit():
    ping()


def count():
    return len(events)


def other_count():
    return len(others)


def aliased():
    # One list under two arguments.
    shared = []
    return alias(shared, shared)


def bundled():
    # The witness: the same list twice, inside one argument.
    shared = []
    return aliasBundle([shared, shared])
