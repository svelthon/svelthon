<script>
// The same markup in Svelte's own language. Not a copy of the expected answers:
// the answers are read off this component at run time, so the day Svelte changes
// its rule the test says so instead of pinning a stale one.
let n = $state(1);
let text = $state('b');

let one = $state('');
let mixed = $state('');
let two = $state('');
let braced = $state('');
let staticValue = $state('');
</script>

<button data-k="change" onclick={() => { n = 2; text = 'c'; }}>change</button>

<input data-k="one" type="radio" value="{n}" bind:group={one} />
<input data-k="mixed" type="radio" value="a-{n}" bind:group={mixed} />
<input data-k="two" type="radio" value="{n}{text}" bind:group={two} />
<input data-k="braced" type="radio" value={n} bind:group={braced} />
<input data-k="static" type="radio" value="fixed" bind:group={staticValue} />

<p data-k="one">{one}</p>
<p data-k="mixed">{mixed}</p>
<p data-k="two">{two}</p>
<p data-k="braced">{braced}</p>
<p data-k="static">{staticValue}</p>
