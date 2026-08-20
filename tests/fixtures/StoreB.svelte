<script module>
    // A JavaScript component, deliberately: it consumes a Python store without
    // declaring Python, and so keeps JavaScript semantics on its values —
    // exactly like a .js consuming a .ts module.
    import { store } from '../../src/counter_store.svelte.py';
</script>

<p data-k="b">B:{store.count}:{store.history}</p>
<button data-k="reset" onclick={store.reset}>reset</button>
