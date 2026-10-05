# The same comprehension over a name `__js__` brings and the module exports.
__js__ = {"./js_reexport_source.js": ["counter"]}
__all__ = ["counter", "listed"]

listed = [counter for counter in range(2)]
