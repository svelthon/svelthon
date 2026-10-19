<script lang="python">
importjs {first, second} from "./read_order.js"

kind: str = "default"
</script>

{#snippet card(x=second())}<output>{first() + ":" + x}</output>{/snippet}
{#snippet two(x=second(), y=first())}<output>{y + ":" + x}</output>{/snippet}

{#if kind == "default"}
    {@render card()}
{:else}
    {@render two()}
{/if}
