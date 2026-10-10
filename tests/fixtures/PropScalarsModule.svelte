<script module>
    import PropScalarsPython from './PropScalarsPython.svelte';
</script>

<script lang="python">
# The Python child of `PropScalars`, imported in a `<script module>`, the way
# the README writes a composition.
from context_scalars import Price, Label

price = Price(0.5)
whole = 1.0
label = Label("hello")
</script>

<div data-k="module"><PropScalarsPython {price} whole={whole} {label} /></div>
