<script lang="python">
# The same function under another name: the witness for ImportedBindable.
importjs {bindable as calculate} from "./imported_bindable.js"
value: int = calculate(7)


@export
def change():
    global value
    value += 1
</script>

<output data-k="child">{value}</output>
