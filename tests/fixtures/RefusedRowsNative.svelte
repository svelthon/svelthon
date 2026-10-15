<script>
    // RefusedRows in Svelte.
    import { untrack } from 'svelte';
    import { makeRows } from './refused_rows.js';

    let { kind = 'getter' } = $props();
    let rows = $state(untrack(() => makeRows(kind)));

    function attempt() {
        try {
            rows[1] = 99;
        } catch (error) {
            return /state_unsafe_mutation/.test(error.message) ? 'refused' : error.message;
        }
        return 'written';
    }
</script>

<p>{rows.length}</p>
<output>{attempt()}</output>
