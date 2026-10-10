<script lang="python">
# The scalars of `ContextScalars`, handed as props: a float subclass, a whole
# float and a str subclass, to a Python child and a JavaScript one.
from context_scalars import Price, Label
importjs PropScalarsPython from "./PropScalarsPython.svelte"
importjs ContextScalarsJsProps from "./PropScalarsJs.svelte"

price = Price(0.5)
whole = 1.0
label = Label("hello")
</script>

<PropScalarsPython {price} whole={whole} {label} />
<ContextScalarsJsProps {price} whole={whole} {label} />
<div data-k="spread"><PropScalarsPython {**{"price": price, "whole": whole, "label": label}} /></div>
