<script>
    // The same changes in Svelte, over its own collections: the witness for
    // CallbackMutation.
    import { SvelteSet, SvelteMap } from 'svelte/reactivity';

    let { kind = 'set add' } = $props();

    const flags = new SvelteSet(['key', 2]);
    const table = new SvelteMap([['shown', 'old']]);

    export function change() {
        if (kind.startsWith('set')) {
            flags.delete(2);
            flags.add(3);
        } else {
            table.set('shown', 'new');
        }
    }
</script>

<output>{[...flags].map(String).sort().join(',')}|{table.get('shown')}</output>
