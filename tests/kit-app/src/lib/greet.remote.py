"""A remote function, in Python: a module SvelteKit loads when it decides, and
calls when the page asks, over HTTP."""

__js__ = {"$app/server": ["query"]}
__all__ = ["greeting"]


def _greeting():
    return {"text": "hello from Python", "total": sum([1, 2, 3])}


greeting = query(_greeting)
