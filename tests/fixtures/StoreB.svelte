<script module>
    // Un composant JavaScript, délibérément : il consomme un store Python sans
    // déclarer Python, et garde donc la sémantique JavaScript sur ses valeurs —
    // exactement comme un .js consommant un module .ts.
    import { store } from '../../src/counter_store.svelte.py';
</script>

<p data-k="b">B:{store.count}:{store.history}</p>
<button data-k="reset" onclick={store.reset}>reset</button>
