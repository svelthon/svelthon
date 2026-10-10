<script lang="python">
from browser import aio

value = 42
then = "inner"
attrs = {"catch": "inner"}


async def later():
    await aio.sleep(0)
    return "done"


async def echo(n):
    await aio.sleep(0)
    return n


async def fail():
    await aio.sleep(0)
    raise ValueError("no")
</script>

<p data-k="short">{#await later() then value}{value}{/await}</p>
<p data-k="long">{#await later()}waiting{:then value}{value}{/await}</p>
<p data-k="outer">{#await echo(value) then value}{value}{/await}</p>
<p data-k="bare">{#await later() then}resolved{/await}</p>
<p data-k="caught">{#await fail() catch}failed{/await}</p>
<p data-k="named then">{#await later() if then else fail() then result}{result}{/await}</p>
<p data-k="named then long">{#await later() if then else fail()}waiting{:then result}{result}{/await}</p>
<p data-k="leading then">{#await then or later()}waiting{:then result}{result}{/await}</p>
<p data-k="key catch">{#await later() if attrs . catch else fail() then result}{result}{/await}</p>
