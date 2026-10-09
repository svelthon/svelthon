# A method descriptor called through its type, handed a receiver of another
# type, and one of a subclass. `python3` on this module gives the lines the test
# expects.
__all__ = ["answers"]


class K:
    pass


class Rows(list):
    pass


def answers():
    out = []

    for call, args in [(list.append, (K(), 5)), (dict.get, (K(), 1)), (str.upper, (1,))]:
        try:
            out.append(repr(call(*args)))
        except TypeError as error:
            out.append(str(error))

    rows = Rows()
    list.append(rows, 5)
    out.append(repr(rows))
    return out
