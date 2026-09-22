<script>
// The same markup in Svelte's own language: the answers are read off it at run
// time rather than written out.
let selected = $state([]);
</script>

<input data-k="a1" type="checkbox" value="a" bind:group={selected} />
<input data-k="b" type="checkbox" value="b" bind:group={selected} />
<input data-k="a2" type="checkbox" value="a" bind:group={selected} />

<p data-k="picked">{selected.join(',')}</p>
