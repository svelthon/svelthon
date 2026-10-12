# The three modules named `store` something, as Python imports them.
__all__ = ["read"]

import facade_value
import facade_derived
import facade_function


def read():
    return [facade_value.store, facade_derived.store, facade_function.store()]
