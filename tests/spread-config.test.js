// A prop in a spread crosses as the same prop written by name: a config's
// float is a number to a JavaScript child either way, as in a component written
// in Svelte. And a spread on an element keeps an option's object, which is how
// it finds its select.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadConfig from './fixtures/SpreadConfig.svelte';
import SpreadConfigNative from './fixtures/SpreadConfigNative.svelte';

const run = (component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(component, { target });
    const seen = () => [
        target.querySelector('[data-k="direct"]').textContent,
        target.querySelector('[data-k="spread"]').textContent,
        target.querySelector('select').selectedIndex
    ];

    flushSync();
    const first = seen();

    instance.change();
    flushSync();

    return [first, seen()];
};

test('a config in a spread reaches a JavaScript child as it does by name, before and after a change', () => {
    const native = run(SpreadConfigNative);

    // The witness: numbers in both positions, and the option the model holds.
    expect(native).toEqual([
        ['0.25|0.25', '0.25|0.25', 0],
        ['0.50|0.50', '0.50|0.50', 1]
    ]);
    expect(run(SpreadConfig)).toEqual(native);
});
