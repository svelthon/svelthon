<script lang="python">
# An exported function the component also hands a registry, and returns.
importjs { hold } from "./kept_registry.js"


@export
def action():
    return 7


hold(action)


@export
def returned():
    return action
</script>

<p>ready</p>
