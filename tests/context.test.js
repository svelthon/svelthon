import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CtxHost from './fixtures/CtxHost.svelte';
import ContextFromJs from './fixtures/ContextFromJs.svelte';
import ContextFromPy from './fixtures/ContextFromPy.svelte';
import ContextKeys from './fixtures/ContextKeys.svelte';
import ContextCallbacks from './fixtures/ContextCallbacks.svelte';
import ContextCallbacksFromJs from './fixtures/ContextCallbacksFromJs.svelte';
import ContextScalars from './fixtures/ContextScalars.svelte';
import PropScalars from './fixtures/PropScalars.svelte';
import ContextLate from './fixtures/ContextLate.svelte';
import ContextLateNative from './fixtures/ContextLateNative.svelte';

// A scalar a Python provider sets is both readers' own: a JavaScript child reads
// a number and a string, and a Python one the value that was set, of its own
// class and a whole float still a float, as CPython hands it over.
test('a scalar set by Python reads as itself in Python and as a number in JavaScript', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ContextScalars, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;

    expect(read('python')).toBe('Price|EUR|float|1.0|Label|HELLO!');
    expect(read('js')).toBe('number|0.50|number|1.00|string|hello');
});

// And the same scalars handed as props. The compiler reads the child's own file:
// a child written in Python is handed the value itself, where the prop went
// through JavaScript's number and came back a plain `float`, its class and its
// methods gone; a JavaScript child is still handed JavaScript's own.
test('a scalar handed as a prop reads as itself in Python and as a number in JavaScript', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PropScalars, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;

    expect(read('python')).toBe('Price|EUR|float|1.0|Label|HELLO!');
    expect(read('js')).toBe('number|0.50|number|1.00|string|hello');
    expect(target.querySelector('[data-k="spread"] p').textContent).toBe('Price|EUR|float|1.0|Label|HELLO!');
});

// A context value crosses languages like any other value: a scalar becomes the
// reader's own. JavaScript's 0.42 is a Python float, and Python's 0.42 is a
// JavaScript number.
describe('a context number across languages', () => {
    const read = (Component, key) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('set in JavaScript, read in Python', () => {
        expect(read(ContextFromJs, 'python-reads')).toBe('0.4');
    });

    test('set in Python, read in JavaScript', () => {
        expect(read(ContextFromPy, 'javascript-reads')).toBe('number:0.84');
    });

    // And a key: a Python float is an object, and Svelte's context is a Map.
    test('a float key set in JavaScript is found from Python', () => {
        expect(read(ContextFromJs, 'python-reads-key')).toBe('half');
    });

    test('a float key set in Python is found from JavaScript', () => {
        expect(read(ContextFromPy, 'javascript-reads-key')).toBe('half');
    });

    test('a key is equal as a dict key is', () => {
        expect(read(ContextKeys, 'found')).toBe("['half', 'one', 'one', 'pair', 'own nan', None]");
    });

    // `None` crossed as Brython's own object, which JavaScript calls true: a
    // child testing `value == null` took the branch for a present value, and a
    // `None` key and a `null` key were two entries of the Map. Both are
    // JavaScript's `null`, as `None` is at every other door, and a Python
    // reader still reads `None`.
    test('None set in Python is null to JavaScript and None to Python', () => {
        expect(read(ContextFromPy, 'javascript-reads-none')).toBe('true:false');
        expect(read(ContextFromPy, 'python-reads-none')).toBe('True');
    });

    test('a None key and a null key are one key, in either direction', () => {
        expect(read(ContextFromPy, 'javascript-reads-none-key')).toBe('under none');
        expect(read(ContextFromJs, 'python-reads-none-key')).toBe('under null');
    });
});

// And a callable: a function, a bound method and a callable instance set in
// Python are JavaScript functions to a JavaScript reader, called with its own
// arguments as a JavaScript parent's would be, and the callables themselves to
// a Python reader. A JavaScript callback is called from Python with
// JavaScript's values.
describe('a context callable across languages', () => {
    const read = (Component, key) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('set in Python, called from JavaScript', () => {
        expect(read(ContextCallbacks, 'javascript-calls')).toBe('function:7 function:0.25 function:0.5 function:0.5');
    });

    test('set in Python, read in Python as itself', () => {
        expect(read(ContextCallbacks, 'python-calls')).toBe("[7, '0.25', 'float', 2]");
    });

    test('set in JavaScript, called from Python', () => {
        expect(read(ContextCallbacksFromJs, 'python-calls-javascript')).toBe('0.25|number,number');
    });
});

// Context is per subtree, where a store is per application: two instances of
// the same component can carry different values of it. It is also the only safe
// place for per-request state under server rendering, since the component tree
// is rebuilt on every render.
describe('context', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(CtxHost, { target });
        flushSync();
        return (k, cell = 'leaf') =>
            target.querySelector(`[data-k="${k}"] [data-k="${cell}"]`).textContent;
    };

    test('a descendant reads what an ancestor set', () => {
        // CtxMiddle separates the two and knows nothing of the context. The
        // trailing slash is the missing key, which renders as nothing.
        expect(setup()('a')).toBe('dark/');
    });

    test('two subtrees carry independent values', () => {
        const leaf = setup();

        expect(leaf('a')).toBe('dark/');
        expect(leaf('b')).toBe('light/');
    });

    test('a missing key is None, not undefined', () => {
        // Asked in Python: the markup renders None as nothing, so there it is
        // indistinguishable from undefined. `is None` is the question that
        // still separates them.
        expect(setup()('a', 'is-none')).toBe('True');
    });
});

// Called once the component is mounted, from an event handler say, a context
// call is refused, and under the name Svelte gives the same call written in
// JavaScript: the author reads `setContext` or `getContext`, never a function
// of Svelthon's own.
test('a context call made after initialisation is refused as Svelte refuses it', () => {
    const refusal = (Component, name) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Component, { target });
        flushSync();
        try {
            instance[name]();
            return 'accepted';
        } catch (error) {
            return error.message;
        }
    };

    for (const name of ['publish', 'read']) {
        expect(refusal(ContextLate, name)).toBe(refusal(ContextLateNative, name));
    }
    expect(refusal(ContextLate, 'publish')).toMatch(/`setContext\(\.\.\.\)` can only be used/);
});
