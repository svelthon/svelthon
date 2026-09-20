"""The module half of the integration probe.

`__all__` is grown rather than written once, which is how a conditional export
is written and which the compiler used to read at its first value.
"""

__all__ = ["LIMIT"]
__all__ += ["TITLE"]

LIMIT = 3
TITLE = "ensemble"
CACHÉ = "not exported"
