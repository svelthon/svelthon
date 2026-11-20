<script lang="python">
    # Both hooks bound at keys no text says.
    importjs Hooks from "./lifecycle_hooks.js"

    for name in ["on_mount", "on_destroy"]:
        globals()[name] = getattr(Hooks, name)
</script>

<output>ready</output>
