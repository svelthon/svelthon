<svelte:options customElement="typed-element" />

<script lang="python">
# A custom element whose props are declared with their types: an attribute
# arrives as the number, the flag or the list the annotation names.
start: int = 0
step: float = 1.0
enabled: bool = False
tags: list = []
label = "internal"
</script>

<p>{start + 1}|{step * 2}|{enabled}|{len(tags)}</p>
