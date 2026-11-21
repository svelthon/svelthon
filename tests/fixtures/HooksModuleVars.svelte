<script lang="python">
    # Both hooks bound through vars(), the module's dict at its level.
    importjs Hooks from "./lifecycle_hooks.js"

    vars()["on_mount"] = Hooks.on_mount
    vars()["on_destroy"] = Hooks.on_destroy
</script>

<output>ready</output>
