<script lang="python">
# A setter written `async def` runs as a handler written so runs, whether it
# awaits or not.
from browser import aio

text = "initial"
later = "initial"


def get():
    return text


async def put(value):
    global text
    text = value.upper()


def get_later():
    return later


async def put_later(value):
    global later
    await aio.sleep(0)
    later = value.upper()
</script>

<input data-k="now" bind:value={get, put} />
<input data-k="later" bind:value={get_later, put_later} />
<p>{text}|{later}</p>
