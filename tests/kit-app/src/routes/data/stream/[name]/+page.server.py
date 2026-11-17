# The value of each case as a coroutine's result, which SvelteKit streams.
import models

__all__ = ["load"]


async def later(name):
    return models.make(name)


def load(event):
    return {"later": later(event["params"]["name"])}
