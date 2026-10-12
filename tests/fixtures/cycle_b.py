# Runs while `cycle_a` is half made: what it bound before its import is there,
# what it binds after is not yet.
__all__ = ["seen", "refused", "now"]

import cycle_a
from cycle_a import early

seen = early

try:
    from cycle_a import late
    refused = None
except ImportError:
    refused = "ImportError"


def now():
    return cycle_a.late
