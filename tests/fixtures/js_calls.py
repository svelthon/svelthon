# Python calling JavaScript, where what JavaScript does with the values is read
# something other than their contents: the identity of a callback, and the
# identity of two arguments to one call.
__js__ = {
    "./js_calls.js": [
        "on",
        "off",
        "ping",
        "alias",
        "aliasBundle",
        "direct",
        "nested",
        "listed",
        "same",
        "onOptions",
        "offOptions",
    ]
}
__all__ = [
    "listen",
    "stop",
    "emit",
    "count",
    "listen_other",
    "other_count",
    "aliased",
    "bundled",
    "direct_probe",
    "nested_probe",
    "listed_probe",
    "depths_probe",
    "listen_boxed",
    "stop_boxed",
    "boxed_count",
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


# A callback that declares no parameter, called by JavaScript with one. The
# wrapper trims the call to the signature; a bare Python function raises.
def done():
    return 42


def direct_probe():
    return direct(done)


def nested_probe():
    return nested({"done": done})


def listed_probe():
    return listed([done, done])


def depths_probe():
    return same({"a": done, "list": [done]})


boxed = []


def boxed_handler():
    boxed.append(1)


def listen_boxed():
    onOptions({"handler": boxed_handler})


def stop_boxed():
    offOptions({"handler": boxed_handler})


def boxed_count():
    return len(boxed)
