<script>
    // RefusedWrite in Svelte.
    import { untrack } from 'svelte';
    import { keep } from './kept.js';

    let { kind = 'list', catching = false } = $props();
    let rows = $state(untrack(() => (kind === 'list' ? [] : { n: 0 })));

    keep(rows);

    const held = () => (kind === 'list' ? rows.length : rows.n);

    function write() {
        try {
            if (kind === 'list') rows.push(1);
            else rows.n = 1;
        } catch (error) {
            if (!catching) throw error;
            return held();
        }
        return 'written';
    }
</script>

<p>{held()}</p>
<output>{write()}</output>
