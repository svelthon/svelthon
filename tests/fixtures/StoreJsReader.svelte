<script>
    // A JavaScript page reading a store's container, and nothing of Python's
    // reading it: what the store keeps as it was handed is read through its
    // proxy.
    import { store } from './counted.svelte.py';
</script>

<p data-k="js">{store.rows.length}</p>
<p data-k="first">{store.rows[0]?.n ?? '-'}</p>
