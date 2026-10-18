<script lang="python">
    # A child held under an attribute of what holds it, written as the tag,
    # `<Holder.Child />`, inside a block, `<row.Child />`, or read into a name
    # first, and swapped for a child of the other language.
    importjs PriceChild from "./HeldPriceChild.svelte"
    importjs NumberChild from "./HeldNumberChild.svelte"
    importjs {box} from "./held_boxes.js"

    kind: str = "instance"
    mode: str = "direct"

    class Price(float):
        pass

    value = Price(0.5)
    value.currency = "EUR"
    chosen = PriceChild

    class Box:
        def __init__(self):
            self.Child = chosen

    class Slotted:
        __slots__ = ("Child",)

        def __init__(self):
            self.Child = chosen

    class Property:
        @property
        def Child(self):
            return chosen

    class Namespace:
        Child = chosen

    Holder = {
        "instance": lambda: Box(),
        "slots": lambda: Slotted(),
        "property": lambda: Property(),
        "class": lambda: Namespace,
        "dict": lambda: {"Child": chosen},
        "javascript": lambda: box(chosen),
    }[kind]()

    @derived
    def Picked():
        return Holder["Child"] if kind == "dict" else Holder.Child

    @export
    def swap():
        global chosen
        chosen = NumberChild if chosen is PriceChild else PriceChild
        if kind == "dict":
            Holder["Child"] = chosen
        elif kind != "property":
            Holder.Child = chosen
</script>

{#if mode == "direct"}
    <Holder.Child {value} />
{:else if mode == "row"}
    {#each [Holder] as row}<row.Child {value} />{/each}
{:else}
    <Picked {value} />
{/if}
