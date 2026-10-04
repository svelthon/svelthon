// What a `<select multiple>` writes back is Svelte's array of the chosen
// values, and it was kept as that array: after the first choice the Python name
// held a `JavascriptArray`, `selected.clear()` raised `AttributeError`, and a
// button that empties the selection worked until somebody used the control. A
// test of the items alone passed, the items being the right floats.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectMultipleList from './fixtures/SelectMultipleList.svelte';
import SelectMultipleListNative from './fixtures/SelectMultipleListNative.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const select = (key) => target.querySelector(`[data-k="${key}"]`);
    const choose = (key) => {
        for (const option of select(key).options) option.selected = true;
        select(key).dispatchEvent(new Event('change', { bubbles: true }));
        flushSync();
    };
    const read = () => ({
        chosen: [...select('script').selectedOptions].map((one) => one.textContent),
        count: target.querySelector('output').textContent
    });
    const clear = () => {
        target.querySelector('button').click();
        flushSync();
    };

    return { target, choose, read, clear };
};

test('a selection made in the page can be cleared by Python, as in Svelte', () => {
    const python = mounted(SelectMultipleList);
    const native = mounted(SelectMultipleListNative);

    for (const one of [python, native]) one.choose('script');
    expect(python.read()).toEqual(native.read());

    for (const one of [python, native]) one.clear();
    expect(python.read()).toEqual(native.read());
});

// The same crossing for a name the markup declared, which the setter writes
// itself.
test('and a markup cell holds a Python list of the chosen values', () => {
    const python = mounted(SelectMultipleList);

    python.choose('cell');

    expect(python.target.querySelector('p').textContent).toBe('list [0.25, 0.5]');
});
