<script>
    // The same child in Svelte: the witness for CrossedFloat.
    let { value = $bindable(0.25) } = $props();

    export function half() {
        value = 0.5;
    }

    export function whole() {
        value = 15.0;
    }
</script>

<p data-k="child">number:{value}</p>
