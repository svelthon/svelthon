<script>
    // A JavaScript child calling what a Python parent shared, as it would call
    // what a JavaScript parent shared: with its own arguments.
    import { getContext } from 'svelte';

    const called = ['zero', 'formatted', 'bound', 'instance'].map((key) => {
        const fn = getContext(key);
        return `${typeof fn}:${fn(key === 'zero' ? 1 : 0.25)}`;
    });
</script>

<p data-k="javascript-calls">{called.join(' ')}</p>
