<script>
    // The same writes to Svelte's own state behind each kind, which Svelte
    // refuses before it stores them. The keys are read with their values: a
    // key only listed has no signal of its own, and `delete` hides it before
    // Svelte refuses the write.
    import { untrack } from 'svelte';

    let { kind = 'del' } = $props();

    const table = $state({ a: 1, b: 2, c: 3 });
    const bytes = $state([97, 98, 99]);
    const named = $state({ name: 'handler', defaults: [1] });

    let n = $state(0);
    let size = $state(1);
    class Box {
        static get n() {
            return n;
        }
        static set n(value) {
            n = value;
        }
        static get size() {
            return size;
        }
        static set size(value) {
            size = value;
        }
    }

    // A hierarchy whose classes read one signal, as Python's read one class.
    let inherited = $state(1);
    class First {
        get n() {
            return inherited;
        }
        call() {
            return inherited;
        }
    }
    class Base extends First {}
    class Sub extends Base {}
    class Leaf extends Sub {}
    const [base, sub, leaf] = [new Base(), new Sub(), new Leaf()];

    const reads = {
        class: () => String(Box.n),
        'special method': () => String(Box.size),
        'bytearray item': () => bytes.join(' '),
        'bytearray append': () => bytes.join(' '),
        'function name': () => named.name,
        'function defaults': () => String(named.defaults[0]),
        'subclass call': () => `True ${base.call()} ${sub.call()} ${leaf.call()}`,
        bases: () => `True ${sub.n} ${leaf.n} True True`
    };
    const writes = {
        class: () => (Box.n = 1),
        'special method': () => (Box.size = 99),
        'bytearray item': () => (bytes[0] = 120),
        'bytearray append': () => bytes.push(120),
        'function name': () => (named.name = 'other'),
        'function defaults': () => (named.defaults = [5]),
        'subclass call': () => (inherited = 99),
        bases: () => (inherited = 99)
    };
    const read = untrack(() => reads[kind] ?? (() => Object.keys(table).filter((key) => table[key] !== undefined).join(' ')));
    const write = untrack(() => writes[kind] ?? (() => delete table.b));

    export function held() {
        return read();
    }

    function attempt() {
        try {
            write();
        } catch (error) {
            return /state_unsafe_mutation/.test(error.message) ? 'refused' : error.message;
        }
        return 'written';
    }
</script>

<p>{held()}</p>
<output>{attempt()}</output>
