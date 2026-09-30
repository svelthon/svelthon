<script lang="python">
# What a component's `async def` export resolves to is converted as a
# synchronous export's return value is.
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
async def async_failing():
    raise ValueError("boom")


async def half():
    return 0.5
</script>

{#await half() then value}<p data-k="await">{value}</p>{/await}
