<script lang="python">
# What `{#await}` hands its names is Python's own value, as a name bound by
# `await` holds it: the same object, of its own class, whether the value is
# there already or a coroutine returns it, and the exception itself in `catch`.
kind: str = "float"


class Price(float):
    currency = "EUR"


rows = [1.0]


def make():
    if kind == "float":
        return 1.0
    if kind == "price":
        return Price(0.5)
    if kind == "list":
        return rows
    return {"price": Price(0.5)}


held = make()


def describe(value):
    if kind == "list":
        return f"{type(value).__name__}:{type(value[0]).__name__}:{value is held}"
    if kind == "dict":
        return f"{type(value).__name__}:{type(value['price']).__name__}:{value is held}"
    return f"{type(value).__name__}:{getattr(value, 'currency', '-')}:{value is held}"


async def later():
    return held


async def failing():
    raise ValueError("no answer")


def add(items):
    items.append(2.0)
</script>

<output data-k="sync">{#await held then item}{describe(item)}{/await}</output>
<output data-k="async">{#await later()}waiting{:then item}{describe(item)}{/await}</output>
<output data-k="caught">{#await failing()}waiting{:then item}{item}{:catch failure}{type(failure).__name__}{/await}</output>
{#await later() then items}<button onclick={lambda: add(items)}>add</button>{/await}
<output data-k="length">{len(rows)}</output>
