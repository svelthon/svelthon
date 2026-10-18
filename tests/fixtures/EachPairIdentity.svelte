<script lang="python">
# Pairs an iterable makes anew at each walk, the same rows in them, under a key
# read off the pair itself: each walk is new rows. Or, `keying` "mixed", read
# off its members for the first row and off the pair for the others.
kind: str = "enumerate"
keying: str = "identity"
version = 0
values = ["a", "b"]
mapping = {0: "a", 1: "b"}


def rows():
    unused = version
    if kind == "enumerate":
        return list(enumerate(values))
    if kind == "zip":
        return list(zip(range(2), values))
    return list(mapping.items())


def rowkey(pair):
    return pair[0] if keying == "mixed" and pair[0] == 0 else id(pair)


@export
def step():
    global version
    version += 1
</script>

{#each rows() as pair (rowkey(pair))}<input aria-label={str(pair)} />{/each}
