<script lang="python">
# A value handed to a custom element's `value` property, by name or by a spread:
# a NaN, an instance of a subclass of float, int or str, or a plain one.
kind: str = "price"
form: str = "direct"


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


value = {
    "nan": lambda: float("nan"),
    "price": lambda: Price(0.5),
    "count": lambda: Count(1),
    "label": lambda: Label("yes"),
    "float": lambda: 0.5,
}[kind]()
</script>

{#if form == "direct"}<value-property value={value}></value-property>{:else}<value-property {**{"value": value}}></value-property>{/if}
