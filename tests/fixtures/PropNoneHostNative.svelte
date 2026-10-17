<script>
    // PropNoneHost in Svelte, passing `undefined` and `null`.
    import Child from './PropWriteKindsChildNative.svelte';

    const given = { value: undefined };
    const givenNull = { value: null };
</script>

<div data-k="name"><Child value={undefined} /></div>
<div data-k="spread"><Child {...given} /></div>
<div data-k="name-null"><Child value={null} /></div>
<div data-k="spread-null"><Child {...givenNull} /></div>
