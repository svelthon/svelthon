# What a memoryview answers: a slice read after its buffer changed, an item
# read from the end, a write out of the view or of a value no byte holds, and
# a view released. `python3` gives these same lines.
__all__ = ["answers"]


def answer(run):
    try:
        return repr(run())
    except Exception as error:
        return f"{type(error).__name__}: {error}"


def sliced():
    source = bytearray(b"abc")
    tail = memoryview(source)[1:]
    source[1] = 120
    tail[1] = 122
    return list(tail), bytes(source), tail.obj is source


def written(key, value):
    def run():
        source = bytearray(b"abc")
        memoryview(source)[key] = value
        return bytes(source)
    return run


def released():
    view = memoryview(bytearray(b"abc"))
    view.release()
    return view[0]


def answers():
    return [answer(sliced), answer(lambda: memoryview(b"abc")[-1]), answer(written(3, 120)),
            answer(written(0, -1)), answer(released)]
