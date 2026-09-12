# A module whose export is a value JavaScript built. `.remote.py` is the real
# case: `accepted = query(_accepted)` calls SvelteKit's own `query()`, and the
# plugin later checks the object that call returned.
__js__ = {"./js_stamp.js": ["stamp"]}
__all__ = ["marked", "plain"]


def _work():
    return 42


marked = stamp(_work)

plain = 7
