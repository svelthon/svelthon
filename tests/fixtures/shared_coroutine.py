# One coroutine object, handed over by two routes: as the return value of an
# exported function, and inside data. The counter lives in the Python body, so
# what is measured is the body running, not the shape of the result.
from browser import aio

__all__ = [
    "direct",
    "nested",
    "fresh",
    "count",
    "clear",
    "reset",
    "nested_broken",
    "direct_broken",
    "arm",
]

calls = []

pending = None
broken = None


async def work():
    calls.append(1)
    await aio.sleep(0)
    return 42


async def failing():
    await aio.sleep(0)
    raise ValueError("no such page")


def clear():
    calls.clear()


def reset():
    # Every caller awaits the coroutine made here: one built and dropped is
    # what Brython's `RuntimeWarning` is for, said whenever the collector runs.
    global pending
    calls.clear()
    pending = work()


def arm():
    # Separate from `reset`, so the tests that never await a failure do not
    # create one: a coroutine built and dropped is exactly what Brython's
    # `RuntimeWarning` is for, and the suite has no business adding noise.
    global broken
    broken = failing()


def nested_broken():
    # The generic label: a coroutine met inside data is converted under the name
    # `coroutine`, since the data has no position of its own.
    return {"a": broken}


def direct_broken():
    # The same object, returned by a named export, which does have one.
    return broken


def direct():
    return pending


def nested():
    return {"a": pending, "b": pending}


def fresh():
    # The witness: two creations are two coroutine objects, and two runs.
    return work()


def count():
    return len(calls)
