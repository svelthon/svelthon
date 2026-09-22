<script lang="python">
from browser import aio


async def later():
    await aio.sleep(0)
    return "done"


# A coroutine created and thrown away: a real mistake, which has to be told.
def drop():
    later()
</script>

<!-- Handed to Svelte, which awaits it: not dropped. -->
{#await later() then value}<p data-k="shown">{value}</p>{/await}

<button data-k="drop" onclick={drop}>drop</button>
