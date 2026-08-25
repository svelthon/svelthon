<script lang="python">
value = "start"
checked = False
empty = None
</script>

<!-- `bind:value` with no `={…}` is Svelte's shorthand for `bind:value={value}`.
     Written that way it used to slip past the pair entirely. -->
<input bind:value data-k="text" />
<input type="checkbox" bind:checked data-k="box" />

<p data-k="value">{value}</p>
<p data-k="checked">{checked}</p>
