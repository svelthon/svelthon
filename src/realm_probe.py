# A route event whose URL and Request come from another context, an iframe's:
# the boundary still hands it over as the event it is.
__all__ = ["required"]


def required(event):
    return event["method"] + "|" + event["params"]["slug"]
