<script>
    // The witness: the same hooks registered with Svelte's own functions.
    import { onMount, onDestroy } from 'svelte';
    import { on_mount, on_destroy } from './lifecycle_hooks.js';

    onMount(on_mount);
    onDestroy(on_destroy);
</script>

<output>ready</output>
