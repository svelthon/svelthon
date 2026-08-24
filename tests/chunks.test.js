import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Chunks from './fixtures/Chunks.svelte';

// Jinja's `|batch`, and the one thing an index cannot give you: a <table> needs
// its rows grouped. `itertools.batched` does it, but at the price of an import
// that ships 16 KB of standard library — and it is lazy, so a name read twice
// comes back empty the second time.
describe('chunks', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Chunks, { target });
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

    test('a size below one is refused, and says so', () => {
        expect(setup()('bad')).toContain('size must be an integer of at least one');
    });

    test('and so is a fractional size', () => {
        expect(setup()('fractional')).toContain('size must be an integer of at least one');
    });
});
