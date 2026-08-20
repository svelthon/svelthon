import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import CtxHost from './fixtures/CtxHost.svelte';

// Context is per subtree, where a store is per application: two instances of
// the same component can carry different values of it. It is also the only safe
// place for per-request state under server rendering, since the component tree
// is rebuilt on every render.
describe('context', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(CtxHost, { target });
        flushSync();
        return (k) => target.querySelector(`[data-k="${k}"] [data-k="leaf"]`).textContent;
    };

    test('a descendant reads what an ancestor set', () => {
        // CtxMiddle separates the two and knows nothing of the context.
        expect(setup()('a')).toBe('dark/None');
    });

    test('two subtrees carry independent values', () => {
        const leaf = setup();

        expect(leaf('a')).toBe('dark/None');
        expect(leaf('b')).toBe('light/None');
    });

    test('a missing key is None, not undefined', () => {
        expect(setup()('a').split('/')[1]).toBe('None');
    });
});
