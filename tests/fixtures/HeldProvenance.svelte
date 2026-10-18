<script lang="python">
    # A Python child a JavaScript library kept and Python read back: by name
    # off an object, through a getter, deeper down, off a namespace, or handed
    # back by a function, beside the child imported as it is.
    importjs Child from "./HeldPriceChild.svelte"
    importjs * as Bundle from "./HeldPriceChild.svelte"
    importjs {box, getter, nested, returned, context} from "./held_boxes.js"

    mode: str = "box"

    class Price(float):
        pass

    value = Price(0.5)
    value.currency = "EUR"

    Picked = {
        "box": lambda: box(Child).Child,
        "getter": lambda: getter(Child).Child,
        "nested": lambda: nested(Child).inside.Child,
        "namespace": lambda: Bundle.default,
        "returned": lambda: returned(Child),
        "direct": lambda: Child,
    }[mode]()

    @export
    def method():
        # A method read off a JavaScript object and kept still runs on it.
        kept = context().report
        return kept(0.5)
</script>

<Picked {value} />
