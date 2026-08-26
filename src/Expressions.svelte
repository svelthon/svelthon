<script lang="python">
class Item:
    def __init__(self, label, qty):
        self.label = label
        self.qty = qty


cart = [Item("apple", 3), Item("pear", 1)]


units => sum(i.qty for i in cart)


def clear():
    global cart
    cart = []


def restock():
    global cart
    cart = [Item("apple", 3), Item("pear", 1)]
</script>

{#if cart}
    <output>{len(cart)} lines · {units} units</output>
{:else}
    <output>[] is False in Python, true in JS</output>
{/if}

<output>{[i.label for i in cart]}</output>
<output>{cart[0].label.upper() if cart else "—"}</output>

<button onclick={clear}>clear()</button>
<button onclick={restock}>restock()</button>
