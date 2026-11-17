<script lang="python">
import lazy_doors
value: object = None
kind: str = ""
row: object = None
context: bool = False
if context:
    value = get_context("lazy")
</script>

{#if row is not None}{@render row(lazy_doors.make(kind))}{:else}<output>{lazy_doors.seen(kind, value)}</output>{/if}
