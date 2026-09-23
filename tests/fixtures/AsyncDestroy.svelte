<script module>
import { record } from './lifecycle_log.js';
</script>
<script lang="python">
from browser import aio


async def on_destroy():
    record("destroy-start")
    await aio.sleep(0)
    record("destroy-end")
</script>

<p>alive</p>
