# Attributes of a module's function, put there by a decorator, by the module
# itself, and through a registry that holds the original.
__all__ = ["report", "same"]
registry = []


def tagged(fn):
    fn.label = "marked"
    registry.append(fn)
    return fn


@tagged
def handler():
    return 7


def report():
    seen = [getattr(handler, "label", "missing"), handler.__dict__.get("label", "missing")]
    handler.label = "later"
    seen.append(registry[0].label)
    registry[0].extra = 1
    seen.append(getattr(handler, "extra", "missing"))
    handler.__dict__ = {"swapped": True}
    seen.append(sorted(vars(registry[0])))
    del handler.swapped
    seen.append(hasattr(registry[0], "swapped"))
    seen.append(handler())
    return seen


def same():
    return registry[0] is handler
