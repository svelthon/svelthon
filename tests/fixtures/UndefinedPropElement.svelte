<svelte:options customElement="undefined-prop-element" />

<script lang="python">
# A plain prop the page may set `undefined` to ask for its default, before the
# element is connected or again before it is reconnected. The witness is
# `UndefinedPropElementNative.svelte`.
amount: float = 1.5
</script>

<p>{amount}</p>
