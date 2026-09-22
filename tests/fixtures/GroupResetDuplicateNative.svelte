<script>
// The same form in Svelte's own language: what a reset leaves in a group that
// holds two controls for one value is read off it at run time.
let selected = $state([]);
let halves = $state([]);
let rows = $state([{ name: 'first', selected: [] }, { name: 'second', selected: [] }]);
</script>

<form data-k="form">
    <input data-k="a1" type="checkbox" value="a" checked bind:group={selected} />
    <input data-k="b" type="checkbox" value="b" bind:group={selected} />
    <input data-k="a2" type="checkbox" value="a" checked bind:group={selected} />

    <input data-k="h1" type="checkbox" value={0.5} checked bind:group={halves} />
    <input data-k="h2" type="checkbox" value={0.5} checked bind:group={halves} />

    {#each rows as row, at}
        <input data-k="r{at}-1" type="checkbox" value="x" checked bind:group={row.selected} />
        <input data-k="r{at}-2" type="checkbox" value="x" checked bind:group={row.selected} />
    {/each}

    <button data-k="reset" type="reset">reset</button>
</form>

<p data-k="selected">{selected.join(',')}</p>
<p data-k="halves">{halves.join(',')}</p>
<p data-k="rows">{rows.map((row) => row.selected.join(',')).join(' / ')}</p>
