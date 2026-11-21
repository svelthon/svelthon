<script lang="python">
    # Both hooks bound through a function's __globals__, the module's dict.
    importjs Hooks from "./lifecycle_hooks.js"

    def scope():
        pass

    scope.__globals__["on_mount"] = Hooks.on_mount
    scope.__globals__["on_destroy"] = Hooks.on_destroy
</script>

<output>ready</output>
