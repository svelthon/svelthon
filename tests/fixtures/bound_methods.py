# A method of an instance, handed to a JavaScript library as a callback. The
# controls sit beside it: the same body called from Python, the same body behind
# a lambda, and an ordinary function.
__js__ = {"./js_calls.js": ["invoke", "kindOf", "on", "off", "ping"]}
__all__ = [
    "method_probe",
    "function_probe",
    "wrapped_probe",
    "python_method",
    "method_kind",
    "with_argument",
    "two_receivers",
    "listen_method",
    "stop_method",
    "emit",
    "seen",
]


class Box:
    def __init__(self, label):
        self.label = label
        self.calls = []

    def done(self):
        return 42

    def tag(self, suffix):
        return self.label + suffix

    def note(self):
        self.calls.append(1)


box = Box("a")
other = Box("b")


def done():
    return 42


def method_probe():
    return invoke(box.done)


def function_probe():
    return invoke(done)


def wrapped_probe():
    return invoke(lambda: box.done())


def python_method():
    return box.done()


def method_kind():
    return kindOf(box.done)


def with_argument():
    # The receiver is not one of the arguments the caller counts: JavaScript
    # hands one value, and `tag(self, suffix)` must see it as `suffix`.
    return invoke(box.tag)


def two_receivers():
    # Two instances of one class: their methods must not share a wrapper.
    return [invoke(box.tag), invoke(other.tag)]


def listen_method():
    on(box.note)


def stop_method():
    off(box.note)


def emit():
    ping()


def seen():
    return len(box.calls)
