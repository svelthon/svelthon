# Functions imported by name, published by a store.
from crossing_source import fraction, async_fraction, formatted, rows, failing, run_count

__all__ = ["fraction", "async_fraction", "formatted", "rows", "failing", "run_count", "local_fraction", "chosen"]


def local_fraction():
    return fraction()


@derived
def chosen():
    return fraction
