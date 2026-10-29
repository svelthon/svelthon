<script>
// Shows what a store's function reads, and changes the list another of its
// functions returned.
import store from './held_store.svelte.py';

export function change() {
    store.get_value()[0] = 0.5;
}
</script>

<output>{store.read_value()}</output>
