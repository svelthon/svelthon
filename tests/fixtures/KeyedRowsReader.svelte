<script>
    // A field per row, keyed by the row itself, as a form lists what it edits.
    import { store } from './shared_rows.svelte.py';
</script>

{#each store.rows as row (row)}<input data-k="field" />{/each}
