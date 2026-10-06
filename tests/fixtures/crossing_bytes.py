# bytes and bytearray at every door: exported, handed to a JavaScript
# function, written into a JavaScript object, returned, and handed back.
__js__ = {"./crossing_bytes.js": ["blob_size", "decoded", "keep", "kept"]}
__all__ = ["data", "buffer", "box", "handed", "give", "same", "back", "grow", "shown", "stream", "fill", "fill_local"]

data = b"ab"
buffer = bytearray(b"cd")

box = js.Object.new()
box.data = data
box.buffer = buffer


def handed():
    return [blob_size(data), decoded(buffer)]


def give():
    return data


def same(value):
    return value is data


def back():
    keep(data)
    return kept() is data


def grow():
    buffer.append(101)


# A buffer built byte by byte, exported, and the same loop on one nothing
# exports.
stream = bytearray()


def fill(n):
    for i in range(n):
        stream.append(i % 256)


def fill_local(n):
    local = bytearray()
    for i in range(n):
        local.append(i % 256)


# What Python receives: its kind, its bytes, and whether it is `data` itself.
def shown(value):
    return f"{type(value).__name__}:{value!r}:{value is data}"
