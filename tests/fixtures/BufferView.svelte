<script lang="python">
# A memoryview reads its buffer, as a dict's view reads its dict: what changes
# the buffer, by any route, is what the view shows. A slice is a view too.
source = bytearray(b"ab")
view = memoryview(source)
tail = view[1:]


@export
def change(how):
    if how == "buffer":
        source[0] = 120
    elif how == "another view":
        memoryview(source)[0] = 120
    elif how == "reverse":
        source.reverse()
    elif how == "the view":
        view[0] = 120
    else:
        source[1] = 121


@export
def held():
    return ",".join(str(x) for x in view) + "|" + ",".join(str(x) for x in tail)
</script>

<p>{",".join(str(x) for x in view)}|{",".join(str(x) for x in tail)}</p>
