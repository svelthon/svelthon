<script lang="python">
# Python iterables a snippet's positional pattern takes apart, as Python
# unpacks them: as far as the pattern reads, and never a step further.
def counted():
    yield 10
    yield 20
    raise ValueError("a step past the pattern")


class Rows:
    def __iter__(self):
        return iter((10, 20))
</script>

{#snippet row([a, b], key)}<output data-k={key}>{a}:{b}</output>{/snippet}
{@render row(range(10, 21, 10), "range")}
{@render row(counted(), "generator")}
{@render row(iter([10, 20]), "iterator")}
{@render row(Rows(), "instance")}
{@render row([10, 20], "list")}
