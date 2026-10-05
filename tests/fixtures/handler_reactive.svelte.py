# A reactive module whose function a component sets as a handler, and which
# raises at line 8 of this file.
__all__ = ["count", "boom"]
count = 0


def boom(*args):
    raise ValueError("reactive boom")
