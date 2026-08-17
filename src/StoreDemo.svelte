<script module>
    import { store } from './lib/counter_store.py';
</script>

<p>shared counter: {store.count} — {store.history}</p>
<button onclick={store.increment}>+</button>
