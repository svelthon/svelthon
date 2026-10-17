<script>
    // PropWriteKindsChild in Svelte, its values JavaScript's own.
    const VALUES = { float: 0.5, other: 0.75, int: 1, str: 'a', astral: '\u{1F600}', none: undefined, big: 2n ** 60n, true: true };

    let { value = 'default' } = $props();

    export function own(kind) {
        value = VALUES[kind];
    }

    export function model() {
        return String(value);
    }
</script>

<p>{value}</p>
