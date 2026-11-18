<script>
    // The row a store's function appended, read by JavaScript.
    import { store } from './appended_rows.svelte.py';
</script>

<p data-k="first">{store.rows[0]?.n ?? '-'}</p>
