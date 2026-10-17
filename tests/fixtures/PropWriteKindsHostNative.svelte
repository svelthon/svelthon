<script>
    // PropWriteKindsHost in Svelte, its values JavaScript's own.
    import Child from './PropWriteKindsChildNative.svelte';

    const VALUES = { float: 0.5, other: 0.75, int: 1, str: 'a', astral: '\u{1F600}', none: undefined, big: 2n ** 60n, true: true };

    let value = $state('start');
    let ref;

    export function give(kind) {
        value = VALUES[kind];
    }

    export function own(kind) {
        ref.own(kind);
    }

    export function model() {
        return ref.model();
    }
</script>

<Child bind:this={ref} {value} />
