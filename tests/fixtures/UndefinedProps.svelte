<script lang="python">
# A prop passed as `undefined` takes its default, ordinary or bindable, as in
# Svelte; `null` is a value, None.
value: int = 4
other: int = bindable(8)
</script>

<p data-k="seen">{value}|{other}</p>
