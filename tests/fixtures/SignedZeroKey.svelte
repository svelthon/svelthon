<script lang="python">
# Python finds complex(0.0, 1.0) equal to complex(-0.0, 1.0): replacing one by
# the other keeps the block, and one finds what the other set as a context.
kind: str = "complex"


def make(sign):
    value = complex(sign * 0.0, 1.0)
    return {"complex": value, "tuple": (value,), "frozenset": frozenset({value})}[kind]


key = make(1)
set_context(make(1), "retained")
found = get_context(make(-1))


@export
def flip():
    global key
    key = make(-1)
</script>

<p data-k="found">{found}</p>
{#key key}<input value="draft" />{/key}
