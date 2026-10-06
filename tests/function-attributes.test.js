// A module's function was read by Python through a stand-in with a dictionary
// of its own: `fn.label = "marked"` from a decorator read back as missing in a
// `.py` and a `.svelte.py`, where CPython, Brython alone and a component read
// `"marked"`, and the function a decorator registered was not the one the
// module read. Python reads the function itself, so its attributes are one and
// so is its identity. `python3` on the same module: the values below.
import { test, expect } from 'vitest';
import { report, same } from './fixtures/function_attributes.py';

test('a function attribute is one, read through the module or through the original', () => {
    expect([...report()]).toEqual(['marked', 'marked', 'later', 1, ['swapped'], false, 7]);
});

test('and the function a decorator registered is the one the module reads', () => {
    expect(same()).toBe(true);
});
