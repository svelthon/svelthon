import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from './mounted.js';

import PyBlocks from './fixtures/PyBlocks.svelte';

// Template expressions are Python — including at the four places that were not
// interpolations: what is iterated, what serves as a key, what a {@const} is
// worth, and what a {@html} renders.

let target;
const el = (k) => target.querySelector(`[data-k="${k}"]`);
const text = (k) => [...el(k).children].map((c) => c.textContent).join('|');

beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
    mount(PyBlocks, { target });
    flushSync();
});

describe('the iterable of an {#each} is Python', () => {
    // A list and a tuple are literally JavaScript arrays, so those already
    // worked. Nothing else did.
    test('a dict yields its keys, in its own order', () => {
        expect(text('dict')).toBe('b|a');
    });

    test('.items() yields pairs, destructured by the block', () => {
        expect(text('items')).toBe('b=2|a=1');
    });

    test('a range', () => {
        expect(text('range')).toBe('0|1|2');
    });

    test('a generator', () => {
        expect(text('gen')).toBe('0|1|4|9');
    });

    test('and the block key is still evaluated inside it', () => {
        expect(text('keyed')).toBe('b2|a1');
    });
});

test('the right-hand side of a {@const} has Python semantics', () => {
    // JavaScript would give -3.5: Python's floor division rounds down, and it
    // is Python's that must apply inside a Python template.
    expect(text('const')).toBe('-4|-3');
});

test('{@html} evaluates Python', () => {
    // len() does not exist in JavaScript: had the expression stayed there, the
    // component would have failed to compile.
    expect(el('html').innerHTML).toBe('<b>2</b>');
});

describe('{#key} compares by value', () => {
    test('an equal value does not recreate the block', () => {
        const before = el('keyblock');
        el('rebuild').click();
        flushSync();

        // The tuple is a fresh object — so a fresh JavaScript array, which
        // Svelte would judge different. repr() is what brings them together.
        expect(el('keyblock')).toBe(before);
    });

    test('a different value recreates it', () => {
        const before = el('keyblock');
        el('change').click();
        flushSync();

        expect(el('keyblock')).not.toBe(before);
    });
});
