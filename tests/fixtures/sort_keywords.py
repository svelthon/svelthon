# list.sort takes keyword arguments only, and its signature says so.
__all__ = ["sort_facts"]


def sort_facts():
    try:
        [].sort(1)
        refused = "accepted"
    except TypeError as error:
        refused = str(error)
    return [refused, list.sort.__text_signature__, [].sort.__text_signature__]
