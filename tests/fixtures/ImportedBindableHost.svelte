<script>
    // A parent holding 4 and binding the child's `value`, or handing it over.
    let { Child, bound = false } = $props();
    let value = $state(4);
    let child = $state();

    export function change() {
        child.change();
    }
</script>

{#if bound}<Child bind:value bind:this={child} />{:else}<Child {value} bind:this={child} />{/if}
<output data-k="parent">{value}</output>
