# A JavaScript symbol as a key of a dict and a member of a set.
__all__ = ["keyed"]


def keyed(token, other):
    return [len({token: 1, other: 2}), token in {token: 1}, len({token, token, other})]
