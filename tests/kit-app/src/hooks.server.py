"""The server's hooks, found by SvelteKit by the extensions `moduleExtensions` names."""


async def handle(given):
    response = await given.resolve(given.event)
    response.headers.set("x-python-hook", "handle")
    return response
