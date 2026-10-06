# Builtin methods handed to JavaScript callbacks, which pass (value, index, array).
__all__ = ["run"]


def run():
    rows = [1, 2]
    js.Array.of(5, 6).forEach(rows.clear)
    word = "ab"
    upper = list(js.Array.of(1).map(word.upper))
    taken = []
    try:
        js.Array.of(7).forEach(taken.append)
        appended = "accepted"
    except TypeError as error:
        appended = str(error)
    return [list(rows), upper, appended]
