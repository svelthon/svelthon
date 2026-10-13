<script lang="python">
# A prop whose default calls a JavaScript function imported as `bindable`: the
# call computes the default, and the prop is an ordinary one.
importjs {bindable} from "./imported_bindable.js"
value: int = bindable(7)


@export
def change():
    global value
    value += 1
</script>

<output data-k="child">{value}</output>
