<script lang="python">
# A multiple select bound to a JavaScript array, and a class read off another,
# each holding as data a method's name or a constructor of its own.
importjs { shadowed } from "./shadowed_arrays.js"

kind: str = "null"

picked = shadowed(kind)
classes = shadowed(kind, True)
</script>

<select multiple bind:value={picked}><option value={1}>one</option><option value={2}>two</option></select>
<p class={classes}>text</p>
