<script lang="python">
# An option whose value comes from a spread, the value the model holds: a plain
# float, int or str, a NaN, or an instance of a subclass.
kind: str = "float"
many: bool = False


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


choice = {
    "float": lambda: 0.5,
    "int": lambda: 1,
    "str": lambda: "yes",
    "nan": lambda: float("nan"),
    "price": lambda: Price(0.5),
    "count": lambda: Count(1),
    "label": lambda: Label("yes"),
}[kind]()
attrs = {"value": choice}
picked = [choice] if many else choice
</script>

{#if many}<select multiple bind:value={picked}><option {**attrs}>one</option></select>
{:else}<select bind:value={picked}><option {**attrs}>one</option></select>{/if}
