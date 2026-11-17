<script lang="python">
importjs LazyDoorsChild from "./LazyDoorsChild.svelte"
import lazy_doors
route: str = "prop"
kind: str = "generator"
value = None if route == "snippet" else lazy_doors.make(kind)
bag = {"value": value, "kind": kind}
if route == "context":
    set_context("lazy", value)
</script>

{#snippet row(v)}<output>{lazy_doors.seen(kind, v)}</output>{/snippet}
{#if route == "prop"}<LazyDoorsChild {value} {kind} />
{:else if route == "spread"}<LazyDoorsChild {**bag} />
{:else if route == "context"}<LazyDoorsChild {kind} context={True} />
{:else}<LazyDoorsChild {kind} {row} />{/if}
