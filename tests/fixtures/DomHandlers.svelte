<script lang="python">
# DOM handlers by every road: a JavaScript function by name and through its
# module's namespace, an optional handler and a call that gives none, and a
# Python handler that raises, written by name and in a spread.
from browser import aio

importjs * as callbacks from "./dom_handlers.js"
importjs { receiver } from "./dom_handlers.js"

handler: object = None


def make():
    return None


def fail(event):
    raise ValueError("handler failed")


async def fail_later(event):
    await aio.sleep(0)
    raise ValueError("handler failed later")
</script>

<button data-k="named" onclick={receiver}><span>named</span></button>
<button data-k="namespace" onclick={callbacks.receiver}><span>namespace</span></button>
<button data-k="optional" onclick={handler}>optional</button>
<button data-k="called" onclick={make()}>called</button>
<button data-k="fail" onclick={fail}>direct</button>
<button data-k="fail-spread" {**{"onclick": fail}}>spread</button>
<button data-k="later" onclick={fail_later}>direct</button>
<button data-k="later-spread" {**{"onclick": fail_later}}>spread</button>
