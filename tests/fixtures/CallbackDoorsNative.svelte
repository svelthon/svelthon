<script>
    // The same component in Svelte: the witness for CallbackDoors.
    let { callback } = $props();

    export function apply_value(fn) {
        return fn(0.25);
    }

    export function use_prop() {
        return callback(0.25);
    }
</script>
