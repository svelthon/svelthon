# A dict keyed by a tuple holding a JavaScript object whose name moves, and a
# dict of 400 JavaScript keys, read whole from JavaScript.
__js__ = {"./moving_keys.js": ["inner", "many"]}
__all__ = ["by_tuple", "large"]

by_tuple = {(inner,): 42}
large = {key: i for i, key in enumerate(many)}
