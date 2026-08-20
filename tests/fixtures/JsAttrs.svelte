<script>
    // Idiomatic Svelte: $state proxies deeply, so mutating a key notifies. The
    // question is whether the DOM attribute takes that into account.
    const attrs = $state({ 'data-n': '0' });
    const list = $state(['a']);

    function mutate() {
        attrs['data-n'] = '1';
        list.push('b');
    }
</script>

<p data-k="spread" {...attrs}>spread</p>
<p data-k="attr" title={list.join(',')}>computed attribute</p>
<p data-k="raw" title={list}>raw attribute</p>
<p data-k="witness">{JSON.stringify(attrs)} {list.length}</p>

<button data-k="mutate" onclick={mutate}>go</button>
