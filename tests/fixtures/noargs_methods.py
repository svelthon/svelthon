# Methods that take no arguments, each given one.
__all__ = ["refused"]


def refused():
    out = []
    for call in (
        lambda: [].clear(1),
        lambda: (5).bit_length(1),
        lambda: "a".casefold(1),
        lambda: {}.keys(x=1),
    ):
        try:
            call()
            out.append("accepted")
        except TypeError as error:
            out.append(str(error))
    return out
