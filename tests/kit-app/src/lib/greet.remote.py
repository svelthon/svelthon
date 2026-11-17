"""A remote function, in Python: a module SvelteKit loads when it decides, and
calls when the page asks, over HTTP."""

import models

__js__ = {"$app/server": ["query", "prerender"]}
__all__ = ["greeting", "facts"]


def _greeting():
    return {"text": "hello from Python", "total": sum([1, 2, 3])}


# An instance among them, which the server reads back from the site's address
# as it renders a page that asks: rebuilt there under the build's signature.
def _facts():
    return {"text": "prerendered from Python", "squares": [n * n for n in range(4)], "point": models.Point(3)}


greeting = query(_greeting)

# Prerendered at build, which SvelteKit does by rewriting the declaration of
# its name in the server's code.
facts = prerender(_facts)
