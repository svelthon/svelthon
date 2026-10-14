<script>
    // The same update in Svelte, over a `SvelteSet`: the witness for
    // SetUpdateSource.
    import { SvelteSet } from 'svelte/reactivity';

    let { kind = 'update' } = $props();

    const flags = new SvelteSet([1, 2]);

    function* values() {
        flags.delete(1);
        flags.add(3);
        yield kind === 'update' ? 2 : 9;
    }

    export function change() {
        for (const value of values()) {
            if (kind === 'update') flags.add(value);
            else flags.delete(value);
        }
    }
</script>

<output>{[...flags].sort((a, b) => a - b).join(',')}</output>
