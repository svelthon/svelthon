<script lang="python">
    # Python's scalars spread onto an element, a float and a subclass of float,
    # int and str, beside the same written by name.
    class Price(float):
        pass

    class Count(int):
        pass

    class Label(str):
        pass

    amount = 0.5
    price = Price(1.5)
    count = Count(3)
    label = Label("named")

    @export
    def replace():
        global amount
        amount = 0.25
</script>

<input type="number" data-k="direct" min={amount} step={amount} title={price} data-count={count} aria-label={label} />
<input type="number" data-k="spread" {**{"min": amount, "step": amount, "title": price, "data-count": count, "aria-label": label}} />
