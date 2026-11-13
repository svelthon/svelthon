<script>
    // A JavaScript component that reads an instance a Python store holds, and
    // calls its method
    import { store } from './cart.svelte.py';
</script>

<p>{store.cart.kind} {store.cart.size} {store.cart.items.length} {String(store.cart)}</p>
<button onclick={() => store.cart.add('x')}>add</button>
