<script module>
    import { store } from '../lib/counter_store.py';
</script>

<p data-k="a">A:{store.count}:{store.history}</p>
<button data-k="inc" onclick={store.increment}>+</button>
