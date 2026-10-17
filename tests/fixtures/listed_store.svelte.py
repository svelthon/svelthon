# The same store listing every name it binds: what `unlisted_store` publishes
# without a list.
__all__ = ["NULL", "rows", "label", "n", "seen", "Model", "stop", "doubled", "bump"]

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
