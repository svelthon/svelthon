<script>
    // A JavaScript parent binding the child's list and pushing into it.
    let { Child } = $props();
    let rows = $state([]);
    let child;

    export const reset = () => child.reset();
    export const grow = () => child.grow();
</script>

<Child bind:rows bind:this={child} />
<p data-k="parent">{JSON.stringify(rows)}</p>
<button onclick={() => rows.push(7)}>push</button>
