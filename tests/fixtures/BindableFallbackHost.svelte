<script>
    // A parent binding the child's prop, or passing it, and clearing it.
    import { untrack } from 'svelte';

    let { Child, bound, start } = $props();
    let value = $state(untrack(() => start));
    let child = $state();

    export const clear = () => child.clear();
    export const set = (next) => {
        value = next;
    };
</script>

{#if bound}
    <Child bind:value bind:this={child} />
{:else}
    <Child {value} bind:this={child} />
{/if}
<p data-k="parent">{value === undefined ? 'undefined' : value}</p>
