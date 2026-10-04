# Methods a class binds itself under a name Brython answers with `copyreg`:
# by a lambda, by an `async def`, by assigning a function defined elsewhere.


class Lambda:
    __reduce__ = lambda self: 42


class Coroutine:
    async def __reduce__(self):
        return 42


def reduce_ex(self, protocol):
    return 42


class Assigned:
    __reduce_ex__ = reduce_ex


def through_lambda():
    return Lambda().__reduce__()


async def through_coroutine():
    return await Coroutine().__reduce__()


def through_assigned():
    return Assigned().__reduce_ex__(2)
