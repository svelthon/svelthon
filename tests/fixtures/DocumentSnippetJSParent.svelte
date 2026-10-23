<script>
    // A JavaScript parent's snippet, rendered by a Python child.
    import Child from './DocumentChild.svelte';
</script>

<Child>{#snippet children(value)}<output>{typeof value}:{value}</output>{/snippet}</Child>
