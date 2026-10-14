<script lang="python">
# A box whose `value` is an instance of a subclass, followed or not by a spread
# that gives it the plain value of the same text.
kind: str = "count"
control: str = "checkbox"
spread: bool = True


class Count(int):
    pass


class Label(str):
    pass


original = Count(1) if kind == "count" else Label("yes")
attrs = {"value": 1 if kind == "count" else "yes"} if spread else {}
picked = [] if control == "checkbox" else None


@export
def written():
    one = picked[0] if control == "checkbox" else picked
    return [one is original, type(one).__name__]
</script>

{#if control == "checkbox"}<input type="checkbox" value={original} {**attrs} bind:group={picked} />
{:else}<input type="radio" value={original} {**attrs} bind:group={picked} />{/if}
