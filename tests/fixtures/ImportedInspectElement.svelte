<svelte:options customElement="imported-inspect-element" />

<script lang="python">
# An annotation whose default calls a JavaScript function named like a marker:
# the function is the author's, so the name is a prop, for the element too.
importjs {inspect} from './imported_markers.js'
start: int = inspect(41)
</script>

<p>{start}</p>
