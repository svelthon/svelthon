"""Remote functions in a module named `remote.py`, which SvelteKit takes for
one by its name as it takes `greet.remote.py`."""

__js__ = {"$app/server": ["query"]}
__all__ = ["shout"]


def _shout():
    return {"text": "SHOUTED FROM PYTHON".lower(), "length": len("shout")}


shout = query(_shout)
