# An `aio.Future` failed by Python, handed back by a `def` and by an
# `async def` that awaits it; and one resolved, held in a dict.
from browser import aio

__all__ = ["failed_future", "awaited_future", "held_future"]


def failed_future():
    pending = aio.Future()
    pending.set_exception(ValueError("delayed failure"))
    return pending


async def awaited_future():
    return await failed_future()


def held_future():
    pending = aio.Future()
    pending.set_result({"duration": 0.5})
    return {"later": pending}
