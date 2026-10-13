<script lang="python">
# A derived nothing reads, beside generators the script makes: the derived
# stays lazy, as Svelte's does, and raising is what would show it ran. And a
# generator suspended inside a `with`, which the namespace still holds when
# the script's body ends: as in CPython, nothing has exited it yet.
@derived
def unused():
    raise RuntimeError("unused derived was evaluated")


def numbers():
    yield "a"
    yield "b"


class Guard:
    def __init__(self):
        self.exited = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.exited = True


guard = Guard()


def guarded():
    with guard:
        yield "held"


rows = numbers()
held = guarded()
next(held)


@export
def exited():
    return guard.exited
</script>

{#each rows as item}<p data-k="row">{item}</p>{/each}
