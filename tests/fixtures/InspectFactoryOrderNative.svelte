<script>
    // InspectFactoryOrder in Svelte, the witness.
    let count = $state(0);

    function made() {
        globalThis.__order.push('logged');
    }

    function factory() {
        globalThis.__order.push('logger');
        return made;
    }

    function watched() {
        globalThis.__order.push('value');
        return count;
    }

    $inspect(watched()).with(factory());
</script>

<p>{count}</p>
