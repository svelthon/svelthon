# A set the page watches, kept whole by an intersection_update made outside
# rendering, and one made while rendering.
__all__ = ["flags", "keep_all"]

flags = {1, 2, 3}


def keep_all():
    flags.intersection_update({1, 2, 3})
    return len(flags)
