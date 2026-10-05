# A comprehension holding an `await`, in an async function: awaited where it is
# written, at the top of the function as in one of its blocks.
__all__ = ["doubled", "in_block"]


async def double(v):
    return 2 * v


async def doubled():
    values = [await double(x) for x in range(3)]
    found = {x: await double(x) for x in range(2)}
    return values, found


async def in_block():
    try:
        values = [await double(x) for x in range(2)]
    finally:
        pass
    return len(values)
