<script>
    // The Svelte parent of the mounted crossing matrix: a JavaScript value
    // handed to the Python child, by name or in a spread.
    import Child from './DoorMatrixChild.svelte';

    let { value, door } = $props();
</script>

{#if door === 'js-name'}
    <Child {value} />
{:else}
    <Child {...{ value }} />
{/if}
