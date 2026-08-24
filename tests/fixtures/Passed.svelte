<script lang="python">
# The two places a template expression used to stay JavaScript: what an
# `{#await}` awaits, and what a `{@render}` hands to a snippet. Every expression
# here is Python that JavaScript cannot even parse or resolve.
from browser import aio

items = ["a", "b", "c"]
labels = {"one": "premier"}


async def fetch(n):
    await aio.sleep(0)
    return "got " + str(n)


async def broken():
    await aio.sleep(0)
    raise ValueError("nope")
</script>

{#snippet card(label, count)}
    <em data-k="snippet">{label}/{count}</em>
{/snippet}

{#await fetch(len(items))}
    <p data-k="await">waiting</p>
{:then got}
    <p data-k="await">{got}</p>
{/await}

{#await fetch(items[1:])}
    <p data-k="inline">waiting</p>
{:then got}
    <p data-k="inline">{got}</p>
{/await}

{#await broken()}
    <p data-k="caught">waiting</p>
{:then got}
    <p data-k="caught">{got}</p>
{:catch problem}
    <p data-k="caught">{type(problem).__name__}</p>
{/await}

{@render card(", ".join(items[1:]), len(items))}
{@render card(labels["one"], 1)}
