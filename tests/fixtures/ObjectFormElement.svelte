<svelte:options customElement={{ tag: "object-form-element", shadow: "none" }} />

<script lang="python">
# Declared by the written-out form, the only one that sets `shadow`: its props
# are observed all the same.
start: int = 0
</script>

<p class="object-form">{start + 1}</p>
