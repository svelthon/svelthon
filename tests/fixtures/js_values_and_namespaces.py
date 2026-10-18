# A JavaScript Set's items, JavaScript's null and undefined as a hash and as a
# subscript, and a name bound while globals() is iterated. Each answer is what
# CPython answers where it has one.
from browser import window
from javascript import NULL, UNDEFINED

__all__ = ["answers"]


# Each answer on its own, an error told by its class.
def safely(call):
    try:
        return call()
    except Exception as error:
        return type(error).__name__


def bind_while_iterated():
    global added
    for name in globals():
        added = 1


def answers():
    values = window.Set.new([0.25, 0.5])

    return [
        safely(lambda: repr([f"{x:.2f}" for x in values])),
        safely(lambda: repr(len({None, NULL}))),
        safely(lambda: repr(hash(NULL) == hash(UNDEFINED))),
        safely(lambda: repr([1, 2][NULL])),
        safely(lambda: repr(bind_while_iterated())),
    ]
