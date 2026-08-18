<script module>
    import { store } from '../../src/lib/counter_store.py';
</script>

<p data-k="b">B:{store.count}</p>
<button data-k="reset" onclick={store.reset}>reset</button>
