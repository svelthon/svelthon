<script lang="python">
    importjs PrintedChild from "./PrintedChild.svelte"

    class Money:
        def __init__(self, cents):
            self.cents = cents

        def __str__(self):
            return f"{self.cents // 100}.{self.cents % 100:02d} EUR"

    class Plain:
        pass

    price = Money(150)
    plain = Plain()

    @export
    def raise_price():
        price.cents += 100
</script>

<p data-k="python">{price}</p>
<PrintedChild {price} {plain} />
