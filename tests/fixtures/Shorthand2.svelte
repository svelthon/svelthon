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

<!-- Python's None, handed to a DOM property. Svelte writes what the getter
     returns straight into the element, so None has to become undefined on the
     way out or the field shows the word. -->
<input bind:value={empty} data-k="empty" />
