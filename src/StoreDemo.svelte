<script module>
    import { store } from './lib/counter_store.py';
</script>

<p>compteur partagé : {store.count} — {store.history}</p>
<button onclick={store.increment}>+</button>
