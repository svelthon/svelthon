# One dict JavaScript cannot hold, returned directly and from a coroutine.
__all__ = ["direct", "awaited"]


def direct():
    return {1: "number", "1": "text"}


async def awaited():
    return {1: "number", "1": "text"}
