<script lang="python">
# A comprehension of the script whose name is one `importjs` brings: the name is
# the comprehension's own, and the page still reads the import.
importjs {counter} from "./js_reexport_source.js"

values = [counter for counter in range(2)]
</script>

<p>{values}|{counter}</p>
