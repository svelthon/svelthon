<script lang="python">
from browser import aio

value = 42


async def later():
    await aio.sleep(0)
    return "done"


async def echo(n):
    await aio.sleep(0)
    return n
</script>

<p data-k="short">{#await later() then value}{value}{/await}</p>
<p data-k="long">{#await later()}waiting{:then value}{value}{/await}</p>
<p data-k="outer">{#await echo(value) then value}{value}{/await}</p>
