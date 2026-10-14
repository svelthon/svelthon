<script lang="python">
# One object two boxes stand for, whose `==` says no even to itself: Python's
# `in` and `list.remove` take it by identity first.
initial: bool = False


class Choice:
    def __eq__(self, other):
        return False


choice = Choice()
picked = [choice] if initial else []


@export
def held():
    return [len(picked), choice in picked]
</script>

<input data-k="a" type="checkbox" value={choice} bind:group={picked} />
<input data-k="b" type="checkbox" value={choice} bind:group={picked} />
