<script lang="python">
# An instance API: a function that returns a float, a coroutine, and one
# written with the call form of `@export`.
count = 0


@export
def add(n):
    global count
    count += n
    return count / 2


@export
async def later(n):
    return n * 2


snapshot = export(lambda: {"count": count, "ratio": count / 4})
</script>

<output class="inner">{count}</output>
