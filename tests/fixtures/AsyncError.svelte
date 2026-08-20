<script lang="python">
from browser import aio

state = "-"

async def boom():
    await aio.sleep(0)
    raise ValueError("broken inside the coroutine")

async def fine():
    global state
    await aio.sleep(0)
    state = "ok"
</script>

<p data-k="state">{state}</p>
<button data-k="boom" onclick={boom}>boom</button>
<button data-k="fine" onclick={fine}>fine</button>
