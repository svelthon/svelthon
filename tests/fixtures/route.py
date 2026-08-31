# A SvelteKit route module, in the shape the framework calls it: `load` is a
# coroutine, `actions` a mapping of names to handlers, and both receive the
# request event.
__all__ = ["load", "actions", "GET", "config", "boom", "streaming"]

from browser import aio

# Not a function and not a scalar: the export path has to hand it over as plain
# data rather than wrapping its values.
config = {"prerender": True, "trailing": "always"}


async def load(event):
    await aio.sleep(0)
    # `.get()` and `.items()` are the point: the event must arrive as real dicts,
    # not as JavaScript objects.
    return {
        "slug": event["params"]["slug"],
        "page": int(event["query"].get("page", "1")),
        "method": event["method"],
        "keys": sorted(event["params"].keys())
    }


def GET(event):
    return {"method": event["method"], "path": event["params"]["slug"]}


def boom(event):
    raise ValueError("no such page")


async def slowly():
    await aio.sleep(0)
    return {"rows": [1, 2, 3]}


def streaming(event):
    # SvelteKit's streaming shape: what is ready now beside what is not. The
    # coroutine has to reach the framework as a promise.
    return {"now": event["params"]["slug"], "later": slowly()}


async def failing(event):
    await aio.sleep(0)
    raise KeyError("gone")



def save(event):
    return {"saved": event["params"]["slug"]}


def remove(event):
    return {"removed": True}


def refuse(event):
    raise PermissionError("read only")


actions = {"default": save, "remove": remove, "failing": failing, "refuse": refuse}
