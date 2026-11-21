<script lang="python">
    # Both hooks bound through builtins.globals(), globals() by another name.
    importjs Hooks from "./lifecycle_hooks.js"
    import builtins

    builtins.globals()["on_mount"] = Hooks.on_mount
    builtins.globals()["on_destroy"] = Hooks.on_destroy
</script>

<output>ready</output>
