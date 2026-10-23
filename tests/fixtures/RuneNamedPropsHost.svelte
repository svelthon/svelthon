<script>
    // A parent binding the child's `state` and passing its `host`.
    let { Child } = $props();
    let value = $state(5);
    let child = $state();

    export const step = () => child.step();
</script>

<Child bind:state={value} host={7} bind:this={child} />
<p>{value}</p>
