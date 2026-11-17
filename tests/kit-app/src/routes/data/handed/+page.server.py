# The layout's data handed on whole, as SvelteKit's `parent()` merges it.
__all__ = ["load"]


async def load(event):
    return {"parent": await event["js"].parent()}
