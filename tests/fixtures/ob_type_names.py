# A name Brython also uses, `ob_type`, as a module global, a dict key, an
# attribute and a local.
__all__ = ["spelled"]

ob_type = 42
ordinary = 5


class Box:
    pass


def spelled():
    box = Box()
    box.ob_type = 1
    keyed = {"ob_type": 1, "x": 2}
    keyed["y"] = 3

    def local():
        ob_type = 1
        return sorted(locals())

    return [
        globals()["ordinary"],
        globals()["ob_type"],
        type(globals()).__name__,
        box.ob_type,
        sorted(vars(box)),
        len(keyed),
        type(keyed).__name__,
        local(),
    ]
