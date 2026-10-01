<script lang="python">
# A function in a key is equal to itself alone: a new one from the same factory
# makes a new block, the same one in a new container keeps it.
kind: str = "tuple"


def factory():
    def callback():
        return 1

    return callback


kept = factory()


def make(one):
    return {"tuple": (one,), "frozenset": frozenset({one})}[kind]


key = make(kept)


@export
def renew():
    global key
    key = make(factory())


@export
def rewrap():
    global key
    key = make(kept)
</script>

{#key key}<input value="draft" />{/key}
