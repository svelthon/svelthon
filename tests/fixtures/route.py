# A SvelteKit route module, in the shape the framework calls it: `load` is a
# coroutine, `actions` a mapping of names to handlers, and both receive the
# request event.
__all__ = [
    "load",
    "actions",
    "GET",
    "config",
    "boom",
    "streaming",
    "shared",
    "separate",
    "runs_count",
    "given",
    "given_second",
    "both_views",
]

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


# How many times a coroutine body has actually run, which is the half the shape
# of the result cannot show.
runs = []


async def counted():
    runs.append(1)
    await aio.sleep(0)
    return {"answer": 42}


def shared(event):
    # One coroutine object under three keys, one of them a level down. Two
    # references to a coroutine are not two runs of it.
    task = counted()
    return {"a": task, "b": task, "nested": {"c": task}}


def separate(event):
    # The control: two coroutine objects, which are two runs.
    return {"a": counted(), "b": counted()}


def runs_count(event):
    return len(runs)


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


def given(value):
    # What the boundary handed over, asked from Python. A request event arrives
    # as real dicts — `.get()` and `.keys()` answer — and everything else has to
    # arrive as itself, with its own fields where the author put them.
    if isinstance(value, dict):
        return {"kind": "dict", "keys": sorted(value.keys())}

    return {"kind": type(value).__name__, "payload": getattr(value, "payload", "missing")}


def given_second(first, value):
    # The same question about an argument that is not the first: every argument
    # of every call takes this road, not only the event a route is handed.
    return given(value)


def both_views(event):
    # The two ways of reading one query string, which have to agree: the
    # snapshot a Python author reads, and the URL the same event carries.
    raw = event["js"].url.searchParams

    return [
        event["query"].get("tag"),
        raw.get("tag"),
        list(raw.getAll("tag")),
        # `route.id` is a string or None, and the snapshot reads it through a
        # guard: what lands here is the id, never the object holding it.
        event["route"],
    ]
