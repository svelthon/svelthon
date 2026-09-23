<script module>
const fractional = Promise.resolve(0.42);
const absent = Promise.resolve(null);
</script>
<script lang="python">
from browser import aio


async def python_fractional():
    await aio.sleep(0)
    return 0.42
</script>

{#await fractional then value}<p data-k="js-float">{round(value, 1)}</p>{/await}
{#await absent then value}<p data-k="js-none">{value is None}</p>{/await}
{#await python_fractional() then value}<p data-k="py-float">{round(value, 1)}</p>{/await}
