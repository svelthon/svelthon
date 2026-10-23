<svelte:options customElement={{ tag: 'rune-named-element', shadow: 'none' }} />

<script lang="python">
# A custom element's props are bindables, so this one is named like a rune too.
state: int = 1
</script>

<output>{state}</output>
