<script lang="python">
# Markers under an annotation, as TypeScript annotates a rune: the type is
# the value's, the marker says what the name is.
log: object = None
count = 1
total: int = derived(lambda: count * 2)
watch: object = effect(lambda: log(f"count {count}"))
focus: object = export(lambda: total + 1)


def bump():
    global count
    count += 1
</script>

<p>{total}</p>
<button onclick={bump}>bump</button>
