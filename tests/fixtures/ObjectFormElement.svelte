<svelte:options customElement={{
    tag: "object-form-element",
    shadow: "none",
    extend: (Base) => class extends Base { settings = { note: "props: none" }}
}} />

<script lang="python">
# Declared by the written-out form, the only one that sets `shadow`: its props
# are observed all the same. The words `props:` inside `extend`, and the `}}`
# of the object nested there, are not an option of the element.
start: int = 0
</script>

<p class="object-form">{start + 1}</p>
