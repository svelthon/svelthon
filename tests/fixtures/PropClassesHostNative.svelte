<script>
    // PropClassesHost in Svelte, its values JavaScript's own.
    import Child from './PropClassesChildNative.svelte';

    const VALUES = { half: 0.5, other: 0.75 };
    let value = $state('start');
    let ref;

    export function give(kind) {
        value = VALUES[kind];
    }

    export function own(kind) {
        ref.own(kind);
    }

    export function peek() {
        ref.peek();
    }

    export function ask() {
        ref.peek();
    }

    export function model() {
        return ref.model();
    }
</script>

<Child bind:this={ref} {value} />
