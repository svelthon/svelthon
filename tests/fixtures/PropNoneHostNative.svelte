<script>
    // PropNoneHost in Svelte, passing `null`.
    import Child from './PropWriteKindsChildNative.svelte';

    const given = { value: null };
</script>

<div data-k="name"><Child value={null} /></div>
<div data-k="spread"><Child {...given} /></div>
