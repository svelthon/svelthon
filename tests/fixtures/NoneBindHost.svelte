<script>
    let { Child } = $props();
    let value = $state('x');
    let child;

    export const clear = () => child.clear();
</script>

<Child bind:value bind:this={child} />
<p data-k="parent">{value == null}:{Boolean(value)}</p>
