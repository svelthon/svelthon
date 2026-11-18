<script>
    // One row read under two names of a store.
    import { store } from './shared_rows.svelte.py';
</script>

<p data-k="rows">{store.rows[0]?.n ?? '-'}</p>
<p data-k="other">{store.meta.other?.[0]?.n ?? '-'}</p>
