<script lang="python">
# A multiple select bound to a JavaScript array holding a NaN, an option for
# each of its values.
importjs { values } from "./foreign_nan.js"

picked = values()
choice = picked[0]
</script>

<select multiple bind:value={picked}><option value={choice}>none</option><option value={0.5}>half</option></select>
