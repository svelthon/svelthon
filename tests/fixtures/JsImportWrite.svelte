<script lang="python">
# A name `importjs` brings: the page reads it live, and Python writes it nowhere.
importjs {counter} from "./js_reexport_source.js"


@export
def overwrite():
    globals()["counter"] = 7


@export
def read_global():
    global counter
    return counter
</script>

<p>{counter}</p>
