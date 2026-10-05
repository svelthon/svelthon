<script lang="python">
# A JavaScript object handed over as a prop, its property bound to a field: the
# write calls its setter, with no read of its getter before it.
model: object = None
</script>

<input bind:value={model.value} />
