<script lang="python">
    # Both hooks bound at their keys of the namespace.
    importjs Hooks from "./lifecycle_hooks.js"

    globals()["on_mount"] = Hooks.on_mount
    globals()["on_destroy"] = Hooks.on_destroy
</script>

<output>ready</output>
