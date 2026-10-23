<script lang="python">
    # A Python parent's snippet, rendered by a Python child.
    importjs Child from "./DocumentChild.svelte"
</script>

<Child>{#snippet children(value)}<output>{type(value).__name__}:{value}</output>{/snippet}</Child>
