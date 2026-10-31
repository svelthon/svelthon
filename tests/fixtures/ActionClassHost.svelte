<script>
    // The parent of ActionClass and of its Svelte twin: a state holding an
    // instance of a class whose field is a state, as Svelte 5 writes one, so the
    // field is read by the getter of its class.
    class Counter {
        n = $state(1);
    }

    let { Child, report } = $props();
    const model = $state({ counter: new Counter() });

    export function bump() {
        model.counter.n += 1;
    }
</script>

<Child {model} {report} />
