// `to_py` reads a JavaScript value as Python, and it is the guard an author
// puts on a boundary — which is the one place anyone reaches for it.
//
// Nothing exercised it on a value that actually needed converting. A mutation
// sweep said so in one line: invert the test that asks whether the converted
// value carries `to_dict` and the else branch calls `null()`, so **every**
// conversion would raise `toDict is not a function` — and the suite stayed
// green, because no test made one.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ToPy from './fixtures/ToPy.svelte';

describe('to_py', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ToPy, { target });
        flushSync();

        return (what) => String(instance.lire(what));
    };

    test('reads a JavaScript object as a dict', () => {
        expect(setup()('converted')).toBe("dict:{'a': 1}");
    });

    test('and a JavaScript array as a list', () => {
        expect(setup()('array')).toBe('list:[1, 2]');
    });

    test('and a scalar as itself', () => {
        expect(setup()('number')).toBe('float:0.25');
    });

    // Identity is the test, and it is the truth being told: nothing was
    // converted, so there is nothing to finish. Asking a Python instance for
    // `to_dict` found a **bound method** — an object, not a JavaScript function
    // — and `to_py` raised on a value it was supposed to leave alone.
    test('leaves a value that was already Python alone', () => {
        const read = setup();

        expect(read('already')).toBe("dict:{'python': 1}");
        expect(read('instance')).toMatch(/^Carte:/);
    });
});
