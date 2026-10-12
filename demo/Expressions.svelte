<script lang="python">
class Item:
    def __init__(self, label, qty):
        self.label = label
        self.qty = qty


cart = [Item("apple", 3), Item("pear", 1)]
emptied = 0


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
<output>emptied {emptied}×</output>

<button onclick={clear}>clear()</button>
<!-- The same, written in the markup: `:=` assigns, and two at once is a tuple —
     where JavaScript reaches for its comma operator. -->
<button onclick={lambda: (cart := [], emptied := emptied + 1)}>(cart := [], emptied := emptied + 1)</button>
<button onclick={restock}>restock()</button>
