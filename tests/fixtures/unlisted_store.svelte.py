# A store with no `__all__`, which publishes every name it binds: a class, the
# destructor of an `@effect.root`, names an import and a star import brought,
# beside the state, the derived and the function, which have a signal.
from javascript import NULL
from starred_rows import *

n = 1
seen = 0


class Model:
    pass


@effect.root
def stop():
    global seen
    seen = n


@derived
def doubled():
    return n * 2


def bump():
    global n
    n += 1
