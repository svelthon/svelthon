<script>
// The same markup in Svelte's own language. The answers are read off this at
// run time rather than written out, so the day Svelte changes what a checkbox
// group collects, the test says so instead of pinning a stale rule.
let picked = $state([]);
</script>

<input data-k="a" type="checkbox" value="a" bind:group={picked} />
<input data-k="b" type="checkbox" value="b" bind:group={picked} />
<input data-k="c" type="checkbox" value="c" bind:group={picked} />

<p data-k="picked">{picked.join(',')}</p>
