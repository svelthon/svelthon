<script lang="python">
# A coroutine built once and handed back by a DOM handler. Clicking twice hands
# the same object over twice; the counter is in the Python body, so what is
# measured is the body running.
from browser import aio

calls = []


async def work():
    calls.append(1)
    await aio.sleep(0)
    return 42


pending = work()


def go():
    return pending


def fresh():
    # The witness: a new coroutine per click is two pieces of work, and must
    # stay so.
    return work()


def total():
    return len(calls)
</script>

<button data-k="go" onclick={go}>go</button>
<button data-k="fresh" onclick={fresh}>fresh</button>
<p data-k="total">{total()}</p>
