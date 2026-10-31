<script>
    // ActionClass in Svelte, the witness.
    let { model, report } = $props();

    function observe(node, value) {
        report('install', value.counter.n);

        return { update: (value) => report('update', value.counter.n) };
    }
</script>

<div use:observe={model}></div>
