<svelte:options customElement={{ shadow: "open" }} />

<script lang="python">
# An element with no tag, which the page registers from `Component.element`.
count: int = 1
enabled: bool = False
items: list = []
</script>

<p>{count}|{"on" if enabled else "off"}|{len(items)}</p>
