<script lang="python">
from browser import aio

plain = "no"
awaited = "no"
order = []

async def run_plain():
    global plain
    plain = "yes"

async def run_awaited():
    global awaited, order
    order = order + ["before"]
    await aio.sleep(0)
    order = order + ["after"]
    awaited = "yes"
</script>

<p data-k="plain">{plain}</p>
<p data-k="awaited">{awaited}</p>
<p data-k="order">{order}</p>
<button data-k="go-plain" onclick={run_plain}>plain</button>
<button data-k="go-awaited" onclick={run_awaited}>awaited</button>
