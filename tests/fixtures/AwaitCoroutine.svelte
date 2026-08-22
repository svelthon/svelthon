<script lang="python">
# `{#await}` over a coroutine the component itself declares. The coverage next
# door awaits a JavaScript promise handed in from a module script; this is the
# other half — an `async def` called from the template.
from browser import aio


async def later():
    await aio.sleep(0.01)
    return {"answer": 42}


async def failing():
    await aio.sleep(0.01)
    raise ValueError("no answer")
</script>

<p data-k="block">{#await later()}waiting{:then value}{value["answer"]}{:catch failure}failed{/await}</p>
<p data-k="failing">{#await failing()}waiting{:then value}{value}{:catch failure}{failure}{/await}</p>
