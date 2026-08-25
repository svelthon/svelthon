import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Returns from './fixtures/Returns.svelte';

// The boundary converts in both directions, and only one of them was ever
// written. A Python value handed to a JavaScript function has always crossed —
// that is what makes `query(accepted)` read the same in both languages — but the
// answer came back raw.
//
// Measured, the gap was narrower than it looked and only one test below closes
// it: a **non-integer** number arrived as a JSObject, so `cubicOut(0.5) * 2`
// raised JavascriptError while `js.Math.sqrt(2) * 2` had always worked. A whole
// number, a string, an array, an object and a promise already crossed correctly.
//
// The other six are here for the opposite reason, and they earn their place: the
// conversion is only safe because it is conservative, and they are what proves
// it stayed that way. Reverting the fix fails exactly one of these seven.
describe('what a JavaScript function hands back to Python', () => {
    const setup = async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Returns, { target });
        flushSync();
        await new Promise((resolve) => setTimeout(resolve, 20));
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;
    };

    test('a number is a Python float, not a JavaScript one', async () => {
        const read = await setup();

        expect(read('kind')).toBe('float');
        expect(read('rounded')).toBe('1.414');
        expect(read('arithmetic')).toBe('True');
        expect(read('formatted')).toBe('1.414');
    });

    // Brython keeps the distinction JavaScript does not have: a whole number
    // comes back as an int, so `//` and `range()` behave.
    test('a whole number is an int', async () => {
        expect((await setup())('integer')).toBe('int');
    });

    test('a string answers Python’s string methods', async () => {
        expect((await setup())('text')).toBe('FROM JAVASCRIPT');
    });

    test('a returned function is callable from Python', async () => {
        expect((await setup())('called')).toBe('15');
    });

    // The conservative half, and the reason this conversion is safe: a plain
    // object and an array cross untouched, so a result handed straight back to
    // JavaScript is not mangled on the way through.
    test('a plain object keeps its fields', async () => {
        expect((await setup())('field')).toBe('App.svelte');
    });

    test('an array is a Python sequence', async () => {
        expect((await setup())('listed')).toBe('9');
    });

    // The regression that would matter most: a promise must stay a promise, or
    // every `async def` reaching into JavaScript stops resolving.
    test('a promise is left alone, so it can still be awaited', async () => {
        expect((await setup())('promise')).toBe('awaited');
    });
});
