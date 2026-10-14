<script lang="python">
# A NaN or an instance of a subclass of float, int or str handed to a component
# written in JavaScript, by `value`, by a binding, and by another name.
importjs ChildValueLeaf from "./ChildValueLeaf.svelte"

kind: str = "price"


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


value = {"nan": lambda: float("nan"), "price": lambda: Price(0.5), "count": lambda: Count(1), "label": lambda: Label("yes")}[kind]()
bound = value
</script>

<ChildValueLeaf value={value} other={value} />
<ChildValueLeaf bind:value={bound} other={value} />
