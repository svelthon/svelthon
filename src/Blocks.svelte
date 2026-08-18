<script lang="python">
stock = {"apple": 3, "pear": 1, "fig": 0}


@derived
def left():
    return sum(stock.values())


def sell():
    global stock
    stock = {k: max(0, v - 1) for k, v in stock.items()}
</script>

<ul>
    {#each stock.items() as [name, qty]}
        {@const bar = "▪" * qty or "—"}
        <li>{name} · {bar}</li>
    {/each}
</ul>

<output>{@html "<b>" + str(left) + "</b>"} in stock</output>

<button onclick={sell}>sell()</button>

<style>
    ul { margin: 0; padding: 0; list-style: none }
    li { font-family: ui-monospace, monospace; font-size: 0.92rem }
</style>
