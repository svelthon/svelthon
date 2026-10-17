<script>
    // A Svelte parent handing a Python child a plain object and an array.
    import PyChildData from './PyChildData.svelte';
</script>

<PyChildData data={{ a: 1, b: 2 }} items={['a', 'b', 'c', 'b']} />
