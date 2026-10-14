<script lang="python">
# A choice the model already holds, which only itself is equal to: a NaN, or an
# instance of a subclass of float, int or str whose `==` takes its own class
# only; and the plain float, int and str beside them.
kind: str = "nan"
control: str = "checkbox"


class Price(float):
    def __eq__(self, other):
        return isinstance(other, Price) and float(self) == float(other)


class Count(int):
    def __eq__(self, other):
        return isinstance(other, Count) and int(self) == int(other)


class Label(str):
    def __eq__(self, other):
        return isinstance(other, Label) and str(self) == str(other)


choice = {
    "nan": lambda: float("nan"),
    "price": lambda: Price(0.5),
    "count": lambda: Count(1),
    "label": lambda: Label("yes"),
    "float": lambda: 0.5,
    "int": lambda: 1,
    "str": lambda: "yes",
}[kind]()
picked = [choice] if control == "checkbox" else choice
</script>

{#if control == "checkbox"}<input type="checkbox" value={choice} bind:group={picked} />
{:else}<input type="radio" value={choice} bind:group={picked} />{/if}
