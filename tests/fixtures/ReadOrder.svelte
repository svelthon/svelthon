<script lang="python">
importjs {first, second} from "./read_order.js"

kind: str = "default"

total => first()
</script>

{#snippet card(x=second())}<output>{first() + ":" + x}</output>{/snippet}
{#snippet two(x=second(), y=first())}<output>{y + ":" + x}</output>{/snippet}
{#snippet derived(x=second())}<output>{":".join([total, x])}</output>{/snippet}

{#if kind == "default"}
    {@render card()}
{:else if kind == "derived"}
    {@render derived()}
{:else}
    {@render two()}
{/if}
