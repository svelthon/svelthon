<script>
    // The witness: the same five checkboxes in Svelte itself.
    let { next_value } = $props();
    let value = 1;
    let attrs = { value };
    let long = $state([value]);
    let short = $state([value]);
    let spread = $state([value]);
    let ordered = $state([value]);
    let counted = $state([]);
    let quoted = $state([]);
</script>

<input data-k="long" type="checkbox" value={value} bind:group={long} />
<input data-k="short" type="checkbox" {value} bind:group={short} />
<input data-k="spread" type="checkbox" {...attrs} bind:group={spread} />
<input data-k="ordered" type="checkbox" value={0} {...attrs} bind:group={ordered} />
<input data-k="counted" type="checkbox" value={next_value()} bind:group={counted} />
<input data-k="quoted" type="checkbox" value="{next_value()}" bind:group={quoted} />

<p data-k="long-model">{JSON.stringify(long)}</p>
<p data-k="short-model">{JSON.stringify(short)}</p>
<p data-k="spread-model">{JSON.stringify(spread)}</p>
<p data-k="ordered-model">{JSON.stringify(ordered)}</p>
<p data-k="counted-model">{JSON.stringify(counted)}</p>
<p data-k="quoted-model">{JSON.stringify(quoted)}</p>
