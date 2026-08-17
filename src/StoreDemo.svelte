<script module>
    import { store } from './lib/counter_store.py';
</script>

<button onclick={store.increment}>increment()</button>
<button onclick={store.reset}>reset()</button>
<output>{store.count} · {store.history}</output>
