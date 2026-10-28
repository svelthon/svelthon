<script lang="python">
# Rows Python iterates, taken apart by position in an {#each}, a keyed one, a
# `then` and inside braces, as Python unpacks them; and a key of the index
# alone, which takes no row apart.
def counted(start=10):
    yield start
    yield start + 10


class Pair:
    def __init__(self, start=10):
        self.start = start

    def __iter__(self):
        return iter((self.start, self.start + 10))


async def later(value):
    return value
</script>

{#each [range(10, 21, 10)] as [first, second]}<output data-k="each-range">{first}:{second}</output>{/each}
{#each [counted()] as [first, second]}<output data-k="each-generator">{first}:{second}</output>{/each}
{#each [iter([10, 20])] as [first, second]}<output data-k="each-iterator">{first}:{second}</output>{/each}
{#each [Pair()] as [first, second]}<output data-k="each-instance">{first}:{second}</output>{/each}
{#each [counted(), counted(30)] as [first, second], at (at)}<output data-k="keyed-{at}">{first}:{second}</output>{/each}
{#each [counted(), counted(30)] as [first, *rest], at (at)}<output data-k="starred-{at}">{first}:{rest[0]}</output>{/each}
{#each [{"item": range(10, 21, 10)}] as {item: [first, second]}}<output data-k="nested">{first}:{second}</output>{/each}
{#await later(Pair()) then [first, second]}<output data-k="then">{first}:{second}</output>{/await}
