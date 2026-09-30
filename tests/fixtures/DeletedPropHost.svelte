<script>
    import Child from './DeletedPropChild.svelte';
    let label = $state('a');
    let level = $state(1);
    let child;
    export function drop() { child.drop(); }
    export function seen() { return child.seen(); }
    export function pass() { label = 'b'; level = 2; }
</script>

<Child {label} bind:level bind:this={child} />
