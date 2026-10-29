<script>
// Keeps the function its Python child hands it, and calls it again from a
// cleanup that may run before the first flush.
import Child from './EarlyCallbackChild.svelte';

let { capture } = $props();
let saved = () => -1;

function publish(fn) {
    saved = fn;
    capture('publish', fn());
}

$effect.pre(() => () => capture('clean', saved()));
</script>

<Child {publish} />
