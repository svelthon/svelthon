<script lang="python">
# A value set apart from its `=` by blanks, which names an attribute that
# changes what the binding beside it does: it is the value, never the
# attribute it names. Svelte's witness is SpacedValueNamesNative.svelte.
picked = ["a"]
choice = "b"
checked = "a title"
multiple = "a title"
value = "zz"
type = "radio"
</script>

<div data-k="value before"><input type="checkbox" bind:group={picked} title = {value} value="a" /></div>
<div data-k="type before"><input bind:group={picked} title = {type} type="checkbox" value="a" /></div>
<div data-k="checked after"><input type="checkbox" bind:group={picked} value="a" title = {checked} /></div>
<div data-k="select"><select bind:value={choice} title = {multiple}><option value="a">a</option><option value="b">b</option></select></div>
<p data-k="directive word" title = use:x>word</p>
<p data-k="picked">{", ".join(picked)}</p>
<p data-k="choice">{choice}</p>
