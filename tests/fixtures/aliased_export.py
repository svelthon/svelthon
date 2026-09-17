# The same function published twice: under the name `def` gave it, and under a
# name an assignment gave it. The compiler treats the first as a function of the
# module and the second as a value of it.
from browser import aio

__all__ = [
    "original",
    "alias",
    "sync_original",
    "sync_alias",
    "count",
    "bare",
    "bare_alias",
    "bare_mapping",
    "spread",
    "spread_alias",
]

calls = []


async def original():
    calls.append(1)
    await aio.sleep(0)
    return {"answer": 42}


alias = original


def sync_original(suffix):
    return {"rows": [1], "tag": suffix}


sync_alias = sync_original

# The witness for a function JavaScript built, published under a Python name,
# lives in `exported_js.py`: `marked = stamp(_work)`, whose mark
# `module-exports.test.js` reads on the other side. It is not repeated here.


def bare():
    # Declares nothing, and a consumer hands it an event anyway. The boundary's
    # contract is to trim the call to the signature.
    return 42


bare_alias = bare
bare_mapping = {"run": bare}


def spread(*args):
    return len(args)


spread_alias = spread


def count():
    return len(calls)
