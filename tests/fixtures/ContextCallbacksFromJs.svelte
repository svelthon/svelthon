<script>
    // A JavaScript parent sharing callbacks a Python child calls with Python
    // values, which they receive as JavaScript's.
    import { setContext } from 'svelte';
    import ContextCallbacksFromJsReader from './ContextCallbacksFromJsReader.svelte';

    setContext('fixed', (value) => value.toFixed(2));
    setContext('types', (items) => items.map((one) => typeof one).join(','));
</script>

<ContextCallbacksFromJsReader />
