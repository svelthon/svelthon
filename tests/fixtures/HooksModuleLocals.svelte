<script lang="python">
    # Both hooks bound through locals(), the module's dict at its level.
    importjs Hooks from "./lifecycle_hooks.js"

    locals()["on_mount"] = Hooks.on_mount
    locals()["on_destroy"] = Hooks.on_destroy
</script>

<output>ready</output>
