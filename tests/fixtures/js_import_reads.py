# What reads a name `__js__` brings, or binds a name of its own spelt the same in
# another scope, run: none of it is a write of the import.
__js__ = {"./js_reexport_source.js": ["counter"]}
__all__ = ["answers", "read"]

listed = [counter for counter in range(2)]
mapped = {counter: 1 for counter in range(2)}
gathered = {counter for counter in range(2)}
generated = list(counter for counter in range(2))


def read():
    return counter


def read_global():
    global counter
    return counter


def own_local():
    counter = 5
    return counter


def parameter(counter):
    return counter


class Holder:
    counter = 3


def in_def():
    return [counter for counter in range(2)]


def walrus_in_def():
    found = [(counter := v) for v in range(2)]
    return found, counter


def rebound_nonlocal():
    counter = 1

    def inner():
        nonlocal counter
        counter = 2

    inner()
    return counter


def answers():
    return [
        listed,
        mapped,
        sorted(gathered),
        generated,
        read_global(),
        own_local(),
        parameter(4),
        Holder.counter,
        (lambda counter: counter)(4),
        in_def(),
        walrus_in_def(),
        rebound_nonlocal(),
    ]
