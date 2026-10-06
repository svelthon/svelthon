# Another module reading what `module_names` calls itself.
import module_names

__all__ = ["report"]


def report():
    return [
        module_names.__name__,
        module_names.plain.__module__,
        module_names.Kept.__module__,
        repr(module_names.Kept).split("'")[1],
    ]
