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


class Price(float):
    def cents(self):
        return round(self * 100)


class Backwards(list):
    def __iter__(self):
        return iter(self[::-1])
</script>

{#each [range(10, 21, 10)] as [first, second]}<output data-k="each-range">{first}:{second}</output>{/each}
{#each [counted()] as [first, second]}<output data-k="each-generator">{first}:{second}</output>{/each}
{#each [iter([10, 20])] as [first, second]}<output data-k="each-iterator">{first}:{second}</output>{/each}
{#each [Pair()] as [first, second]}<output data-k="each-instance">{first}:{second}</output>{/each}
{#each [counted(), counted(30)] as [first, second], at (at)}<output data-k="keyed-{at}">{first}:{second}</output>{/each}
{#each [counted(), counted(30)] as [first, *rest], at (at)}<output data-k="starred-{at}">{first}:{rest[0]}</output>{/each}
{#each [{"item": range(10, 21, 10)}] as {item: [first, second]}}<output data-k="nested">{first}:{second}</output>{/each}
{#await later(Pair()) then [first, second]}<output data-k="then">{first}:{second}</output>{/await}
{#await later(Pair()) then (first, second)}<output data-k="then-tuple">{first}:{second}</output>{/await}
{#await later(Pair())}{:then (first, second)}<output data-k="clause-tuple">{first}:{second}</output>{/await}
{#await later(Pair())}{:then (((first, second)))}<output data-k="clause-grouped">{first}:{second}</output>{/await}
{#await js.Promise.resolve({"x": 1, "y": 2}) then (first, second)}<output data-k="then-promise-dict">{first}:{second}</output>{/await}
{#await js.Promise.resolve([10, 20]) then (first, second)}<output data-k="then-promise-list">{first}:{second}</output>{/await}
{#await js.Promise.resolve([Price(0.1), Price(0.2), Price(0.3)]) then [first, *rest, last]}<output data-k="then-promise-starred">{first.cents()}:{rest[0].cents()}:{last.cents()}</output>{/await}
{#await js.Promise.resolve(Backwards([10, 20, 30])) then [first, *rest, last]}<output data-k="then-promise-starred-order">{first}:{rest[0]}:{last}</output>{/await}
{#each [counted()] as ((first, second))}<output data-k="each-grouped">{first}:{second}</output>{/each}
{#each [counted()] as ((first), (second))}<output data-k="each-names-grouped">{first}:{second}</output>{/each}
{#each ["ab"] as (first, second)}<output data-k="each-string">{first}:{second}</output>{/each}
{#each [{"x": 1, "y": 2}] as (first, second)}<output data-k="each-dict">{first}:{second}</output>{/each}
