<svelte:options customElement=unquoted-tag-element />

<script lang="python">
# The tag written without quotes, which Svelte reads as the quoted one.
count: int = 1
enabled: bool = False
items: list = []
</script>

<p>{count}|{"on" if enabled else "off"}|{len(items)}</p>
