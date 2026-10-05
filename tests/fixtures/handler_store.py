# A module whose function a component sets as a handler, and which raises at
# line 6 of this file.
__all__ = ["boom"]


def boom(*args):
    raise ValueError("store boom")
