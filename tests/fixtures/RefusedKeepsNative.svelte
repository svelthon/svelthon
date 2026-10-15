<script>
    // The same write to Svelte's own state behind each kind, which Svelte
    // refuses before it stores it.
    import { untrack } from 'svelte';

    let { kind = 'dict' } = $props();

    class Table {
        n = $state(0);
    }

    class Box {
        n = $state(0);
    }

    class Rows extends Array {
        n = $state(0);
    }

    class Bag extends Set {
        n = $state(0);
    }

    let own = $state(0);
    function handler() {
        return 1;
    }
    Object.defineProperty(handler, 'n', { get: () => own, set: (value) => (own = value) });

    let shared = $state(0);
    class Holder {
        static get n() {
            return shared;
        }
        static set n(value) {
            shared = value;
        }
    }

    const plain = $state({ n: 0 });
    const make = {
        dict: () => plain,
        'dict subclass': () => new Table(),
        instance: () => new Box(),
        'list subclass': () => new Rows(),
        'set subclass': () => new Bag(),
        function: () => handler,
        class: () => Holder
    };
    const one = untrack(() => make[kind]());
    const prototype = Object.getPrototypeOf(one);

    function attempt() {
        try {
            one.n = 1;
        } catch (error) {
            return /state_unsafe_mutation/.test(error.message) ? 'refused' : error.message;
        }
        return 'written';
    }

    export function model() {
        return [one.n, Object.getPrototypeOf(one) === prototype];
    }
</script>

<p>{one.n}</p>
<output>{attempt()}</output>
