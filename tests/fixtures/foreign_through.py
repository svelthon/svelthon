# A JavaScript value thrown through a `with` and through an `await`, the two
# Python frames that marked it before the first door saw it.
__js__ = {"./foreign_thrower.js": ["boom", "later"]}


class _Open:
    def __enter__(self):
        return self

    def __exit__(self, kind, value, tb):
        return False


def withed(value):
    with _Open():
        boom(value)


async def awaited(value):
    await later(value)
