<script>
    // The same child in Svelte: the witness for BoundList.
    let { rows = $bindable([]) } = $props();

    export function reset() {
        rows = [];
    }

    export function grow() {
        rows.push(8);
    }
</script>

<p data-k="child">{rows.join(',')}</p>
