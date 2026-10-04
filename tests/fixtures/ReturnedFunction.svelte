<script lang="python">
# A component handing its parent a function a JavaScript call returned.
importjs { factory } from "./returned_function.js"

@export
def formatter():
    return factory()
</script>
