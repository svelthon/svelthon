# An `aio.Future` failed by Python, handed back by a `def` and by an
# `async def` that awaits it.
from browser import aio

__all__ = ["failed_future", "awaited_future"]


def failed_future():
    pending = aio.Future()
    pending.set_exception(ValueError("delayed failure"))
    return pending


async def awaited_future():
    return await failed_future()
