<script>
    // A parent binding both props of BindableFallbackKept.svelte.
    import { untrack } from 'svelte';
    import Child from './BindableFallbackKept.svelte';

    let { start } = $props();
    let ratio = $state(untrack(() => start));
    let rows = $state(untrack(() => start));
    let child;

    export const clear = () => child.clear();
    export const same = () => child.same();
    export const floated = () => child.floated();
    export const held = () => child.held();
</script>

<Child bind:ratio bind:rows bind:this={child} />
