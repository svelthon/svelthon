import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CtxHost from './fixtures/CtxHost.svelte';
import ContextFromJs from './fixtures/ContextFromJs.svelte';
import ContextFromPy from './fixtures/ContextFromPy.svelte';
import ContextKeys from './fixtures/ContextKeys.svelte';
import ContextCallbacks from './fixtures/ContextCallbacks.svelte';
import ContextCallbacksFromJs from './fixtures/ContextCallbacksFromJs.svelte';

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
