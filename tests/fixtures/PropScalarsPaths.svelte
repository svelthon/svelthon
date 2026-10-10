<script module>
    import { default as Named } from './PropScalarsBindable.svelte';
</script>

<script lang="python">
# One Python child, its props written every way: bound, under a name
# beginning with `on`, and the child imported as `{ default as Named }`. Only
# the way asked is mounted, so a child that throws fails its own way alone.
from context_scalars import Price, Label
importjs Bound from "./PropScalarsBindable.svelte"

way: str = "bound"

price = Price(0.5)
whole = 1.0
label = Label("hello")
</script>

{#if way == "bound"}<div data-k="bound"><Bound bind:price={price} bind:whole={whole} bind:label={label} bind:online={whole} /></div>{/if}
{#if way == "online"}<div data-k="online"><Bound {price} {whole} {label} online={whole} /></div>{/if}
{#if way == "named"}<div data-k="named"><Named {price} {whole} {label} online={whole} /></div>{/if}
