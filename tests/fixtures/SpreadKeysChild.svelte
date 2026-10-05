<script>
    // Shows the props it was handed: their keys, symbols included, and the value
    // under the symbol of `rest_symbols.js`.
    import { token } from './rest_symbols.js';

    let props = $props();
    const keys = $derived(Reflect.ownKeys(props).map((one) => (typeof one === 'symbol' ? `sym:${one.description}` : one)));
</script>

<p>{keys.join(',')}|{String(props[token])}</p>
