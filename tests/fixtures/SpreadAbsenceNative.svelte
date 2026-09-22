<script>
// The same markup in Svelte's own language: what an absent value does to a
// spread attribute is read off it at run time rather than written out.
let presses = $state(0);
let attrs = $state({ title: 'set', disabled: true });

function press() {
    presses += 1;
}

function erase() {
    attrs = { title: undefined, disabled: undefined };
}

const kept = { title: '', 'data-n': 0, 'aria-hidden': false, onclick: press };
</script>

<input data-k="spread" {...attrs} />
<input data-k="direct" title={attrs.title} disabled={attrs.disabled} />
<button data-k="kept" {...kept}>keep</button>
<button data-k="erase" onclick={erase}>erase</button>
<p data-k="presses">{presses}</p>
