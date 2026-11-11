<script lang="python">
    # Both hooks held by a derived, one by the arrow, the other decorated.
    importjs Hooks from "./lifecycle_hooks.js"

    on_mount => Hooks.on_mount

    @derived
    def on_destroy():
        return Hooks.on_destroy
</script>

<output>ready</output>
