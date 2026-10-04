import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Batch from './fixtures/Batch.svelte';

// Jinja's `|batch`, and the one thing an index cannot give you: a <table> needs
// its rows grouped. `itertools.batched` does it, but at the price of an import
// that ships 16 KB of standard library — and it is lazy, so a name read twice
// comes back empty the second time.
describe('batch', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Batch, { target });
        flushSync();

        return (k) => target.querySelector(`p[data-k="${k}"]`)?.textContent ?? null;
    };

    test('groups into rows, the last one short', () => {
        const read = setup();
        expect([read('plain-0'), read('plain-1')]).toEqual(['abc', 'de']);
    });

    test('a third argument pads the last row', () => {
        const read = setup();
        expect([read('filled-0'), read('filled-1')]).toEqual(['abc', 'de·']);
    });

    test('a list, so reading it twice gives the same thing', () => {
        const read = setup();
        expect([read('once-0'), read('once-1')]).toEqual(['abcd', 'e']);
        expect([read('twice-0'), read('twice-1')]).toEqual(['abcd', 'e']);
    });

    test('rows are lists', () => {
        expect(setup()('shape')).toBe('list');
    });

    test('it takes any iterable, not only a sequence', () => {
        // A generator has no len() and no slicing, so the comprehension form
        // cannot do this one.
        expect(setup()('lazily')).toBe("[['A', 'B'], ['C', 'D'], ['E']]");
    });

    test('None means no padding, not a cell holding None', () => {
        // None is an object, so a plain `!== undefined` test would let it
        // through and render it as a cell.
        expect(setup()('no-fill')).toBe("[['a', 'b', 'c'], ['d', 'e']]");
    });

    test('a size below one is refused, and says so', () => {
        expect(setup()('bad')).toContain('n must be an integer of at least one');
    });

    test('and so is a fractional size', () => {
        expect(setup()('fractional')).toContain('n must be an integer of at least one');
    });
});
