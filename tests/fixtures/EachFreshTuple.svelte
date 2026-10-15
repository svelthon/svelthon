<script lang="python">
# Rows the iterable makes at each call, a tuple holding a row the component
# watches, keyed by the tuple itself; and the same row walked by `enumerate()`,
# whose pairs are made anew at each walk and keep their block.
row = {"text": "same"}
step = 0


def rows():
    unused = step
    return [(row,)]


@export
def advance():
    global step
    step += 1
</script>

<div data-k="made">{#each rows() as pair (id(pair))}<input value="draft" />{/each}</div>
<div data-k="paired">{#each enumerate([row]) as (at, one) (at)}<input value="draft" />{/each}</div>
