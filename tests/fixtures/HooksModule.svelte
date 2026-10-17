<script module>
    // The hooks imported by the module script, whose names the Python script
    // reads as its own.
    import { on_mount, on_destroy } from './lifecycle_hooks.js';
</script>

<script lang="python">
    value = 0
</script>

<output>{value}</output>
