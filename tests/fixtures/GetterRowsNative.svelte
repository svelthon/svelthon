<script>
    // GetterRows in Svelte.
    import { untrack } from 'svelte';
    import { makeRows } from './getter_rows.js';

    let { kind = 'counting' } = $props();
    let rows = $state(untrack(() => makeRows(kind)));
</script>

<output>{rows.length}</output>
