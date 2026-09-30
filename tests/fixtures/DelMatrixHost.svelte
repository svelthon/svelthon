<script>
    import DelMatrix from './DelMatrix.svelte';
    let count = $state(1);
    let level = $state(0.5);
    let child;
    export const seen = (name) => child.seen(name);
    export const drop = (name) => child.drop(name);
    export const rebind = (name) => child.rebind(name);
    export const rebindByLoop = (name) => child.rebind_by_loop(name);
    export function pass(name) {
        if (name === 'count') count = 2;
        if (name === 'level') level = 0.75;
    }
</script>

<DelMatrix {count} {level} bind:this={child} />
