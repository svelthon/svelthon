<script lang="python">
# A key replaced by a value Python calls equal keeps its block, and with it
# what the field holds; a different value makes a new one.
ident = (1,)
number = 1


def to_float():
    global ident, number
    ident = (1.0,)
    number = 1.0


def to_bool():
    global ident, number
    ident = (True,)
    number = True


def at_zero():
    global ident, number
    ident = (0,)
    number = 0


def to_zero():
    global ident, number
    ident = (-0.0,)
    number = -0.0


def to_other():
    global ident, number
    ident = (2,)
    number = 2
</script>

{#key ident}<input data-k="tuple" value="draft" />{/key}
{#key number}<input data-k="number" value="draft" />{/key}
<button data-k="float" onclick={to_float}>float</button>
<button data-k="bool" onclick={to_bool}>bool</button>
<button data-k="at-zero" onclick={at_zero}>at zero</button>
<button data-k="zero" onclick={to_zero}>zero</button>
<button data-k="other" onclick={to_other}>other</button>
