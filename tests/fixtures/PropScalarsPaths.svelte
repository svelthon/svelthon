<script module>
    import { default as Named } from './PropScalarsBindable.svelte';
</script>

<script lang="python">
# One Python child, its props written every way: bound, under a name
# beginning with `on`, and the child imported as `{ default as Named }`.
from context_scalars import Price, Label
importjs Bound from "./PropScalarsBindable.svelte"

price = Price(0.5)
whole = 1.0
label = Label("hello")
</script>

<div data-k="bound"><Bound bind:price={price} bind:whole={whole} bind:label={label} bind:online={whole} /></div>
<div data-k="online"><Bound {price} {whole} {label} online={whole} /></div>
<div data-k="named"><Named {price} {whole} {label} online={whole} /></div>
