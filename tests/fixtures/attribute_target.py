# A module another one writes attributes on (`attribute_writer.py`): `x` its
# text binds, and `ready`, which only a function binds.
__all__ = ["x", "ready", "read", "arm"]

x = 1


def read():
    return x


def arm():
    global ready
    ready = True
