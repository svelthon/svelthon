// **A key written as a string with a prefix is the string Python reads**,
// `r"name"` being `"name"`: `unpackByKey` told a string by its opening quote,
// so `r"name"` was a bare name, and the field read was `'r"name"'`. A default
// then stood in for a field the row held, a key holding that text was read in
// its place, and `**rest` left out the wrong one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PrefixedStringKeys from './fixtures/PrefixedStringKeys.svelte';

const EXPECTED = {
    'each-r': '42',
    'each-R': '42',
    'each-u': '42',
    'each-U': '42',
    'each-default': '42',
    'each-backslash': '5',
    'each-rest': '42:extra,r"name"',
    'snippet-r': '42',
    'await-u': '42'
};

test('a field unpacked by a prefixed string key reads the key Python spells', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PrefixedStringKeys, { target });
    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]))).toEqual(
        EXPECTED
    );
});
