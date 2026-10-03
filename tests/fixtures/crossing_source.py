# What the modules below hand on, by name or by a star import.
__all__ = ["fraction", "async_fraction", "formatted", "rows", "failing", "run_count"]

runs = 0
shared = [1]


def fraction():
    return 0.25


async def async_fraction():
    global runs
    runs += 1
    return 0.25


def formatted(value):
    return format(value, ".2f")


def rows():
    return shared


def failing():
    raise ValueError("refused")


def run_count():
    return runs
