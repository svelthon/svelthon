# A generator function and an async one, called by JavaScript while no Python
# frame runs: each marked the frame of its caller, which is not there.
__all__ = ["numbers", "later"]


def numbers():
    yield 1
    yield 2


async def later():
    yield 1
