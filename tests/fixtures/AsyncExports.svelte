<script lang="python">
# What a component's `async def` export resolves to, and what an `aio.Future`
# it returns resolves to, is converted as a synchronous export's return value is.
from browser import aio


def resolved(value):
    pending = aio.Future()
    pending.set_result(value)
    return pending


@export
def sync_value():
    return 0.5


@export
async def async_value():
    return 0.5


@export
def sync_config():
    return {"duration": 0.5}


@export
async def async_config():
    return {"duration": 0.5}


@export
def future_value():
    return resolved(0.5)


@export
def future_config():
    return resolved({"duration": 0.5})


@export
async def async_failing():
    raise ValueError("boom")


@export
def future_failing():
    pending = aio.Future()
    pending.set_exception(ValueError("boom"))
    return pending


async def half():
    return 0.5
</script>

{#await half() then value}<p data-k="await">{value}</p>{/await}
