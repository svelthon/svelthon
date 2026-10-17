<script lang="python">
    # One hook bound by `=`, the other imported under its name.
    importjs Hooks from "./lifecycle_hooks.js"
    importjs {on_destroy} from "./lifecycle_hooks.js"

    on_mount = Hooks.on_mount
</script>

<output>ready</output>
