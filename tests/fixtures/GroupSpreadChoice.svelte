<script lang="python">
# A box whose value comes from a spread, a value only itself is equal to, which
# the model already holds.
kind: str = "price"


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


value = {"nan": lambda: float("nan"), "price": lambda: Price(0.5), "count": lambda: Count(1), "label": lambda: Label("yes")}[kind]()
attrs = {"value": value}
picked = [value]


@export
def held():
    return [len(picked), len(picked) == 1 and picked[0] is value]
</script>

<input type="checkbox" {**attrs} bind:group={picked} />
