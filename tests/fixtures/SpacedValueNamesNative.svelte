<script>
    // Svelte's witness for SpacedValueNames.svelte.
    let picked = $state(['a']);
    let choice = $state('b');
    let checked = 'a title';
    let multiple = 'a title';
    let value = 'zz';
    let type = 'radio';
</script>

<div data-k="value before"><input type="checkbox" bind:group={picked} title = {value} value="a" /></div>
<div data-k="type before"><input bind:group={picked} title = {type} type="checkbox" value="a" /></div>
<div data-k="checked after"><input type="checkbox" bind:group={picked} value="a" title = {checked} /></div>
<div data-k="select"><select bind:value={choice} title = {multiple}><option value="a">a</option><option value="b">b</option></select></div>
<p data-k="directive word" title = use:x>word</p>
<p data-k="picked">{picked.join(', ')}</p>
<p data-k="choice">{choice}</p>
